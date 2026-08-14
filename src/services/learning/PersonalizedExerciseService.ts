import { prisma } from "@/lib/prisma";
import { adaptiveEngine } from "@/services/learning/AdaptiveEngine";
import type { Prisma } from "@prisma/client";
import { exerciseEngine } from "@/services/learning/ExerciseEngine";
import { reviewQueue } from "@/services/learning/ReviewQueueService";
import { personalizedExerciseSources } from "@/services/learning/PersonalizedExerciseSourceService";
import { ruleBasedExerciseProvider } from "@/services/learning/exercise-providers/RuleBasedExerciseProvider";
import { aiExerciseProvider } from "@/services/learning/exercise-providers/AIExerciseProvider";
import { recordUserActivity } from "@/lib/userActivity";
import { processGamification } from "@/lib/gamification";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { getAIConfig } from "@/services/ai/config";
import type { ReviewGrade } from "@/services/learning/SpacedRepetition";
import type {
  ExerciseProviderId,
  PersonalizedExercise,
  RankedExerciseTarget,
} from "@/types/practice";
import type { ExerciseAttempt } from "@/services/learning/ExerciseEngine";

const SKILL_TO_FIELD: Record<string, string> = {
  vocabulary: "vocabularyScore",
  expression: "vocabularyScore",
  grammar: "grammarScore",
  reading: "readingScore",
  listening: "listeningScore",
  speaking: "speakingScore",
  writing: "writingScore",
  pronunciation: "pronunciationScore",
};

export class PersonalizedExerciseService {
  /**
   * Rank sources then generate exercises.
   * Tries AI provider first only when requested; empty AI output falls back to rules.
   */
  async generateSession(
    userId: string,
    options?: {
      count?: number;
      passageId?: string;
      provider?: ExerciseProviderId;
      skill?: string;
      focus?: string;
    }
  ) {
    const count = Math.min(12, Math.max(1, options?.count ?? 5));
    const sources = await personalizedExerciseSources.collect(userId, {
      passageId: options?.passageId,
    });

    let targets = sources.targets;
    if (options?.skill) {
      const skill = options.skill.toLowerCase();
      const filtered = targets.filter((t) => {
        if (skill === "expression") {
          return (
            t.itemType === "EXPRESSION" ||
            t.skill === "expression" ||
            t.kind === "low_mastery_expression"
          );
        }
        if (skill === "vocabulary") {
          return (
            t.itemType === "VOCABULARY" ||
            t.skill === "vocabulary" ||
            t.kind === "low_mastery_word"
          );
        }
        if (skill === "grammar") {
          return (
            t.itemType === "GRAMMAR" ||
            t.skill === "grammar" ||
            t.kind === "grammar_weakness"
          );
        }
        if (skill === "reading") {
          return t.skill === "reading" || t.kind === "skill_weakness";
        }
        return t.skill === skill;
      });
      if (filtered.length) targets = filtered;
    }

    if (options?.focus) {
      const focus = options.focus.toLowerCase();
      const focused = targets.filter(
        (t) =>
          t.label.toLowerCase().includes(focus) ||
          String(t.payload.word || "")
            .toLowerCase()
            .includes(focus) ||
          String(t.payload.expression || "")
            .toLowerCase()
            .includes(focus)
      );
      if (focused.length) {
        targets = [...focused, ...targets.filter((t) => !focused.includes(t))];
      }
    }

    const ctx = {
      userId,
      userLevel: sources.currentLevel,
      targets,
      count,
    };

    let items: PersonalizedExercise[] = [];
    let providerUsed: ExerciseProviderId = "rule";
    const wantAi =
      options?.provider === "ai" && getAIConfig().operational;

    if (wantAi) {
      items = await aiExerciseProvider.generate(ctx);
      providerUsed = "ai";
    }
    if (!items.length) {
      items = await ruleBasedExerciseProvider.generate(ctx);
      providerUsed = "rule";
    }

    return {
      provider: providerUsed,
      focus: {
        skill: options?.skill || null,
        focus: options?.focus || null,
      },
      sources: {
        currentLevel: sources.currentLevel,
        weakestSkills: sources.weakestSkills,
        dueCount: sources.dueReviews.length,
        targetCount: sources.targets.length,
        topTargets: targets.slice(0, 8),
      },
      items,
    };
  }

  async completeSession(
    userId: string,
    items: PersonalizedExercise[],
    attempts: ExerciseAttempt[],
    options?: { durationMs?: number; provider?: ExerciseProviderId }
  ) {
    const exercises = items.map((i) => i.exercise);
    const result = exerciseEngine.evaluateSession(exercises, attempts);
    const byId = new Map(items.map((i) => [i.exercise.id, i]));

    const skillHits: Record<string, { correct: number; total: number }> = {};

    for (const evaluation of result.evaluations) {
      const item = byId.get(evaluation.exerciseId);
      if (!item) continue;
      const skill = item.target.skill || "vocabulary";
      skillHits[skill] ??= { correct: 0, total: 0 };
      skillHits[skill].total += 1;
      if (evaluation.correct) skillHits[skill].correct += 1;

      const expected = Array.isArray(evaluation.expected)
        ? evaluation.expected.join(" ")
        : String(evaluation.expected);
      const given = Array.isArray(evaluation.userAnswer)
        ? evaluation.userAnswer.join(" ")
        : String(evaluation.userAnswer || "");

      if (evaluation.correct) {
        await this.applyCorrect(userId, item);
      } else {
        await this.applyIncorrect(userId, item, given, expected);
      }
    }

    const lp = await prisma.learningProfile.findUnique({ where: { userId } });
    const masteryUpdates: Record<string, number> = {};
    if (lp) {
      const data: Record<string, number> = {};
      for (const [skill, hit] of Object.entries(skillHits)) {
        const field = SKILL_TO_FIELD[skill];
        if (!field) continue;
        const current = Number((lp as unknown as Record<string, number>)[field] ?? 0);
        const next = adaptiveEngine.updateMastery(
          current,
          hit.total ? hit.correct / hit.total : 0
        );
        data[field] = next;
        masteryUpdates[skill] = next;
      }
      if (Object.keys(data).length) {
        await prisma.learningProfile.update({
          where: { userId },
          data: data as Prisma.LearningProfileUpdateInput,
        });
      }
    }

    const attempt = await prisma.personalizedExerciseAttempt.create({
      data: {
        userId,
        total: result.total,
        correctCount: result.correctCount,
        accuracy: result.score / 100,
        durationMs: options?.durationMs,
        provider: options?.provider || "rule",
        items: JSON.stringify(
          items.map((i) => ({
            id: i.id,
            pedagogicalType: i.pedagogicalType,
            targetId: i.target.id,
            skill: i.target.skill,
          }))
        ),
        results: JSON.stringify(result.evaluations),
      },
    });

    await recordUserActivity(userId, {
      studyMinutes: Math.max(2, Math.round((options?.durationMs || 120000) / 60000)),
      xp: Math.max(8, Math.round(result.score / 5)),
    });

    await analyticsService.track(userId, "exercise_completed", {
      type: "personalized_practice",
      score: result.score,
      provider: options?.provider || "rule",
      count: result.total,
    });

    const gamification = await processGamification(userId);

    return {
      result,
      attempt,
      masteryUpdates,
      gamification,
    };
  }

  private async applyCorrect(userId: string, item: PersonalizedExercise) {
    const reviewId = await this.ensureReviewId(userId, item.target);
    if (reviewId) {
      await reviewQueue.complete(userId, reviewId, 4 as ReviewGrade);
    }
  }

  private async applyIncorrect(
    userId: string,
    item: PersonalizedExercise,
    userInput: string,
    correctForm: string
  ) {
    const target = item.target;
    const errorType =
      String(target.payload.errorType || item.pedagogicalType || "accuracy");

    await reviewQueue.recordMistakeAndEnqueue({
      userId,
      errorType,
      skill: target.skill || "vocabulary",
      userInput: userInput || "(blank)",
      correctForm: correctForm || target.label,
      context: String(target.payload.context || target.label),
      source: "personalized_practice",
      contentRef: String(target.payload.passageId || target.itemId),
      level: target.level,
      metadata: {
        targetId: target.id,
        pedagogicalType: item.pedagogicalType,
        itemType: target.itemType,
      },
    });

    const reviewId = await this.ensureReviewId(userId, target);
    if (reviewId) {
      await reviewQueue.complete(userId, reviewId, 1 as ReviewGrade);
    }
  }

  private async ensureReviewId(
    userId: string,
    target: RankedExerciseTarget
  ): Promise<string | null> {
    if (target.reviewId) return target.reviewId;
    if (
      target.itemType !== "VOCABULARY" &&
      target.itemType !== "EXPRESSION" &&
      target.itemType !== "GRAMMAR" &&
      target.itemType !== "MISTAKE" &&
      target.itemType !== "SENTENCE"
    ) {
      return null;
    }

    const existing = await prisma.reviewItem.findUnique({
      where: {
        userId_itemType_itemId: {
          userId,
          itemType: target.itemType,
          itemId: target.itemId,
        },
      },
    });
    if (existing) return existing.id;

    const created = await reviewQueue.enqueue({
      userId,
      itemType: target.itemType,
      itemId: target.itemId,
      skill: target.skill,
      source: "personalized_practice",
      level: target.level,
      context: target.label,
      dueInMinutes: 24 * 60,
      bumpDueOnUpdate: false,
    });
    return created.id;
  }
}

export const personalizedExerciseService = new PersonalizedExerciseService();
