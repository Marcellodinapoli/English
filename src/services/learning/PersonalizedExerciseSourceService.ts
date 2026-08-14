/**
 * Collects learner data and ranks what to practise next (Phase 2).
 * Does not generate exercises — that is ExerciseProvider + PersonalizedExerciseService.
 */
import { prisma } from "@/lib/prisma";
import { contentService } from "@/services/content/ContentService";
import { expressionService } from "@/services/content/ExpressionService";
import { parseJsonArray } from "@/lib/auth";
import { getWeakSkills } from "@/lib/learningProfile";
import type { RankedExerciseTarget } from "@/types/practice";
import type { ReviewItemType } from "@/types/review";

const RECENT_SAVE_MS = 24 * 60 * 60 * 1000;
const LOW_MASTERY = 50;
const VERY_LOW_MASTERY = 20;
const SKILL_WEAK = 65;

export interface PersonalizedExerciseSources {
  passageId?: string;
  currentLevel: string;
  skillScores: {
    vocabulary: number;
    grammar: number;
    reading: number;
    listening: number;
    speaking: number;
    writing: number;
    pronunciation: number;
  };
  weakestSkills: string[];
  problematicGrammarTopics: string[];
  dueReviews: Array<{
    id: string;
    itemType: string;
    itemId: string;
    nextReviewAt: Date;
    masteryScore: number;
    errorCount: number;
    skill: string | null;
  }>;
  savedWords: Array<{
    id: string;
    word: string;
    translation: string;
    level: string;
    masteryScore: number;
    exampleSentence: string;
    exampleTranslation: string;
    savedAt: Date;
    nextReviewAt: Date | null;
    sourceContentId: string | null;
  }>;
  savedExpressions: Array<{
    id: string;
    expression: string;
    translation: string;
    level: string;
    masteryScore: number;
    example: string;
    exampleTranslation: string;
    savedAt: Date;
    nextReviewAt: Date | null;
    expressionId: string;
  }>;
  recentMistakes: Array<{
    id: string;
    errorType: string;
    skill: string;
    userInput: string;
    correctForm: string;
    frequency: number;
    context: string | null;
    lastSeenAt: Date;
  }>;
  passageVocabularyFocus: string[];
  passageExpressions: string[];
  catalogExpressionCount: number;
  targets: RankedExerciseTarget[];
}

function hoursOverdue(next: Date, now: Date) {
  return Math.max(0, (now.getTime() - next.getTime()) / 36e5);
}

function upsertTarget(
  map: Map<string, RankedExerciseTarget>,
  partial: Omit<RankedExerciseTarget, "reasons"> & { reason: string }
) {
  const existing = map.get(partial.id);
  if (existing) {
    existing.priority += partial.priority;
    existing.reasons.push(partial.reason);
    if (partial.due) existing.due = true;
    if (partial.hoursOverdue != null) {
      existing.hoursOverdue = Math.max(
        existing.hoursOverdue ?? 0,
        partial.hoursOverdue
      );
    }
    if (partial.reviewId) existing.reviewId = partial.reviewId;
    if (partial.frequency != null) {
      existing.frequency = Math.max(existing.frequency ?? 0, partial.frequency);
    }
    if (partial.errorCount != null) {
      existing.errorCount = Math.max(existing.errorCount ?? 0, partial.errorCount);
    }
    existing.payload = { ...existing.payload, ...partial.payload };
    return;
  }
  map.set(partial.id, {
    ...partial,
    reasons: [partial.reason],
  });
}

export class PersonalizedExerciseSourceService {
  async collect(
    userId: string,
    options?: { passageId?: string; mistakeLimit?: number }
  ): Promise<PersonalizedExerciseSources> {
    const mistakeLimit = options?.mistakeLimit ?? 20;
    const now = new Date();

    const [savedWords, savedExpressions, recentMistakes, dueReviews, lp] =
      await Promise.all([
        prisma.userVocabulary.findMany({
          where: { userId },
          orderBy: { savedAt: "desc" },
          take: 50,
          select: {
            id: true,
            word: true,
            translation: true,
            level: true,
            masteryScore: true,
            exampleSentence: true,
            exampleTranslation: true,
            savedAt: true,
            nextReviewAt: true,
            sourceContentId: true,
          },
        }),
        prisma.userExpression.findMany({
          where: { userId },
          orderBy: { savedAt: "desc" },
          take: 50,
          select: {
            id: true,
            expression: true,
            translation: true,
            level: true,
            masteryScore: true,
            example: true,
            exampleTranslation: true,
            savedAt: true,
            nextReviewAt: true,
            expressionId: true,
          },
        }),
        prisma.userMistake.findMany({
          where: { userId, resolved: false },
          orderBy: { lastSeenAt: "desc" },
          take: mistakeLimit,
          select: {
            id: true,
            errorType: true,
            skill: true,
            userInput: true,
            correctForm: true,
            frequency: true,
            context: true,
            lastSeenAt: true,
          },
        }),
        prisma.reviewItem.findMany({
          where: { userId, nextReviewAt: { lte: now } },
          orderBy: { nextReviewAt: "asc" },
          take: 40,
          select: {
            id: true,
            itemType: true,
            itemId: true,
            nextReviewAt: true,
            masteryScore: true,
            errorCount: true,
            skill: true,
          },
        }),
        prisma.learningProfile.findUnique({ where: { userId } }),
      ]);

    let passageVocabularyFocus: string[] = [];
    const passageExpressions: string[] = [];
    if (options?.passageId) {
      const passage = contentService.getPassage(options.passageId);
      passageVocabularyFocus = passage?.vocabularyFocus || [];
      const tokenSets = (passage?.sentences || []).map((s) => s.tokens);
      const { spansBySentence } = expressionService.resolveForPassage(
        passageVocabularyFocus,
        tokenSets
      );
      const seen = new Set<string>();
      for (const spans of spansBySentence) {
        for (const span of spans) {
          if (!seen.has(span.expression.id)) {
            seen.add(span.expression.id);
            passageExpressions.push(span.expression.expression);
          }
        }
      }
    }

    const pronunciationEvaluated = lp?.pronunciationEvaluated ?? false;
    const skillScores = {
      vocabulary: lp?.vocabularyScore ?? 0,
      grammar: lp?.grammarScore ?? 0,
      reading: lp?.readingScore ?? 0,
      listening: lp?.listeningScore ?? 0,
      speaking: lp?.speakingScore ?? 0,
      writing: lp?.writingScore ?? 0,
      pronunciation: lp?.pronunciationScore ?? 0,
    };
    const weakestSkills = getWeakSkills(skillScores, 3, {
      pronunciationEvaluated,
    });

    const problematicGrammarTopics = parseJsonArray(
      lp?.problematicGrammarTopics
    );
    const currentLevel = lp?.currentLevel || "ZERO";

    const targets = this.rankTargets({
      now,
      dueReviews,
      savedWords,
      savedExpressions,
      recentMistakes,
      skillScores,
      weakestSkills,
      problematicGrammarTopics,
      currentLevel,
      passageId: options?.passageId,
      passageVocabularyFocus,
    });

    return {
      passageId: options?.passageId,
      currentLevel,
      skillScores,
      weakestSkills,
      problematicGrammarTopics,
      dueReviews,
      savedWords,
      savedExpressions,
      recentMistakes,
      passageVocabularyFocus,
      passageExpressions,
      catalogExpressionCount: expressionService.listCatalog().length,
      targets,
    };
  }

  rankTargets(input: {
    now: Date;
    dueReviews: PersonalizedExerciseSources["dueReviews"];
    savedWords: PersonalizedExerciseSources["savedWords"];
    savedExpressions: PersonalizedExerciseSources["savedExpressions"];
    recentMistakes: PersonalizedExerciseSources["recentMistakes"];
    skillScores: PersonalizedExerciseSources["skillScores"];
    weakestSkills: string[];
    problematicGrammarTopics: string[];
    currentLevel: string;
    passageId?: string;
    passageVocabularyFocus: string[];
  }): RankedExerciseTarget[] {
    const map = new Map<string, RankedExerciseTarget>();
    const wordById = new Map(input.savedWords.map((w) => [w.id, w]));
    const exprById = new Map(input.savedExpressions.map((e) => [e.id, e]));

    for (const review of input.dueReviews) {
      const overdue = hoursOverdue(review.nextReviewAt, input.now);
      const word = wordById.get(review.itemId);
      const expr = exprById.get(review.itemId);
      const label =
        word?.word ||
        expr?.expression ||
        `${review.itemType}:${review.itemId.slice(0, 8)}`;
      upsertTarget(map, {
        id: `${review.itemType}:${review.itemId}`,
        kind: "due_review",
        priority: 100 + Math.min(48, overdue * 2),
        reason: `Due review (${Math.round(overdue)}h overdue)`,
        itemType: review.itemType as ReviewItemType,
        itemId: review.itemId,
        skill: review.skill || skillFromItemType(review.itemType),
        label,
        masteryScore: review.masteryScore,
        errorCount: review.errorCount,
        due: true,
        hoursOverdue: overdue,
        reviewId: review.id,
        level: word?.level || expr?.level,
        payload: {
          word: word?.word,
          translation: word?.translation || expr?.translation,
          example: word?.exampleSentence || expr?.example,
          exampleTranslation:
            word?.exampleTranslation || expr?.exampleTranslation,
          expression: expr?.expression,
        },
      });
    }

    for (const mistake of input.recentMistakes) {
      const repeatBonus = (mistake.frequency - 1) * 15;
      const recencyHours =
        (input.now.getTime() - mistake.lastSeenAt.getTime()) / 36e5;
      const recencyBonus = recencyHours < 24 ? 12 : recencyHours < 72 ? 6 : 0;
      upsertTarget(map, {
        id: `MISTAKE:${mistake.id}`,
        kind: "repeated_mistake",
        priority: 40 + repeatBonus + recencyBonus,
        reason:
          mistake.frequency > 1
            ? `Repeated error ×${mistake.frequency}`
            : "Recent error",
        itemType: "MISTAKE",
        itemId: mistake.id,
        skill: mistake.skill,
        label: mistake.correctForm || mistake.errorType,
        frequency: mistake.frequency,
        errorCount: mistake.frequency,
        payload: {
          errorType: mistake.errorType,
          userInput: mistake.userInput,
          correctForm: mistake.correctForm,
          context: mistake.context,
        },
      });
    }

    for (const word of input.savedWords) {
      const key = `VOCABULARY:${word.id}`;
      if (word.masteryScore < VERY_LOW_MASTERY) {
        upsertTarget(map, {
          id: key,
          kind: "low_mastery_word",
          priority: 35,
          reason: `Very low word mastery (${Math.round(word.masteryScore)}%)`,
          itemType: "VOCABULARY",
          itemId: word.id,
          skill: "vocabulary",
          label: word.word,
          masteryScore: word.masteryScore,
          level: word.level,
          payload: vocabPayload(word),
        });
      } else if (word.masteryScore < LOW_MASTERY) {
        upsertTarget(map, {
          id: key,
          kind: "low_mastery_word",
          priority: 25,
          reason: `Low word mastery (${Math.round(word.masteryScore)}%)`,
          itemType: "VOCABULARY",
          itemId: word.id,
          skill: "vocabulary",
          label: word.word,
          masteryScore: word.masteryScore,
          level: word.level,
          payload: vocabPayload(word),
        });
      }
      if (input.now.getTime() - word.savedAt.getTime() < RECENT_SAVE_MS) {
        upsertTarget(map, {
          id: key,
          kind: "recent_save",
          priority: 20,
          reason: "Recently saved word",
          itemType: "VOCABULARY",
          itemId: word.id,
          skill: "vocabulary",
          label: word.word,
          masteryScore: word.masteryScore,
          level: word.level,
          payload: vocabPayload(word),
        });
      }
    }

    for (const expr of input.savedExpressions) {
      const key = `EXPRESSION:${expr.id}`;
      if (expr.masteryScore < VERY_LOW_MASTERY) {
        upsertTarget(map, {
          id: key,
          kind: "low_mastery_expression",
          priority: 35,
          reason: `Very low expression mastery (${Math.round(expr.masteryScore)}%)`,
          itemType: "EXPRESSION",
          itemId: expr.id,
          skill: "expression",
          label: expr.expression,
          masteryScore: expr.masteryScore,
          level: expr.level,
          payload: exprPayload(expr),
        });
      } else if (expr.masteryScore < LOW_MASTERY) {
        upsertTarget(map, {
          id: key,
          kind: "low_mastery_expression",
          priority: 25,
          reason: `Low expression mastery (${Math.round(expr.masteryScore)}%)`,
          itemType: "EXPRESSION",
          itemId: expr.id,
          skill: "expression",
          label: expr.expression,
          masteryScore: expr.masteryScore,
          level: expr.level,
          payload: exprPayload(expr),
        });
      }
      if (input.now.getTime() - expr.savedAt.getTime() < RECENT_SAVE_MS) {
        upsertTarget(map, {
          id: key,
          kind: "recent_save",
          priority: 20,
          reason: "Recently saved expression",
          itemType: "EXPRESSION",
          itemId: expr.id,
          skill: "expression",
          label: expr.expression,
          masteryScore: expr.masteryScore,
          level: expr.level,
          payload: exprPayload(expr),
        });
      }
    }

    for (const topicId of input.problematicGrammarTopics) {
      const topic = contentService.getGrammar(topicId);
      upsertTarget(map, {
        id: `GRAMMAR:${topicId}`,
        kind: "grammar_weakness",
        priority: 30,
        reason: "Marked grammar weakness",
        itemType: "GRAMMAR",
        itemId: topicId,
        skill: "grammar",
        label: topic?.title || topicId,
        level: topic?.level,
        payload: { topicId, title: topic?.title },
      });
    }

    if (input.skillScores.grammar < SKILL_WEAK) {
      const grammarMistakes = input.recentMistakes.filter(
        (m) => m.skill === "grammar"
      );
      for (const m of grammarMistakes.slice(0, 3)) {
        const topic = contentService.getGrammarByErrorType(m.errorType);
        if (!topic) continue;
        upsertTarget(map, {
          id: `GRAMMAR:${topic.id}`,
          kind: "grammar_weakness",
          priority: 18,
          reason: `Grammar skill weak + error ${m.errorType}`,
          itemType: "GRAMMAR",
          itemId: topic.id,
          skill: "grammar",
          label: topic.title,
          level: topic.level,
          payload: { topicId: topic.id, errorType: m.errorType },
        });
      }
    }

    for (const skill of input.weakestSkills) {
      if (skillScoresValue(input.skillScores, skill) >= SKILL_WEAK) continue;
      upsertTarget(map, {
        id: `SKILL:${skill}`,
        kind: "skill_weakness",
        priority: 15,
        reason: `Weak skill: ${skill} (${Math.round(skillScoresValue(input.skillScores, skill))}%)`,
        itemType: "SKILL",
        itemId: skill,
        skill,
        label: skill,
        masteryScore: skillScoresValue(input.skillScores, skill),
        payload: { skill },
      });
    }

    const passages = contentService.listPassages();
    const levelPassages = passages.filter((p) =>
      p.level.toUpperCase().startsWith(input.currentLevel.toUpperCase())
    );
    const pool = levelPassages.length ? levelPassages : passages.slice(0, 5);
    const savedWordSet = new Set(input.savedWords.map((w) => w.word.toLowerCase()));
    for (const passage of pool.slice(0, 3)) {
      const focus = (passage.vocabularyFocus || []).find(
        (w) => w.split(/\s+/).length === 1 && !savedWordSet.has(w.toLowerCase())
      );
      if (!focus) continue;
      upsertTarget(map, {
        id: `CONTENT:${passage.id}:${focus.toLowerCase()}`,
        kind: "new_content",
        priority: 8,
        reason: `New ${input.currentLevel} content (${passage.title})`,
        itemType: "CONTENT",
        itemId: passage.id,
        skill: "reading",
        label: focus,
        level: passage.level,
        payload: {
          passageId: passage.id,
          focus,
          title: passage.title,
        },
      });
      break;
    }

    if (input.passageId && input.passageVocabularyFocus.length) {
      upsertTarget(map, {
        id: `CONTENT:${input.passageId}:focus`,
        kind: "new_content",
        priority: 10,
        reason: "Current passage vocabulary",
        itemType: "CONTENT",
        itemId: input.passageId,
        skill: "reading",
        label: input.passageVocabularyFocus[0],
        payload: {
          passageId: input.passageId,
          focus: input.passageVocabularyFocus[0],
        },
      });
    }

    return [...map.values()].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.label.localeCompare(b.label);
    });
  }
}

function vocabPayload(word: PersonalizedExerciseSources["savedWords"][number]) {
  return {
    word: word.word,
    translation: word.translation,
    example: word.exampleSentence,
    exampleTranslation: word.exampleTranslation,
    sourceContentId: word.sourceContentId,
  };
}

function exprPayload(
  expr: PersonalizedExerciseSources["savedExpressions"][number]
) {
  return {
    expression: expr.expression,
    translation: expr.translation,
    example: expr.example,
    exampleTranslation: expr.exampleTranslation,
    expressionId: expr.expressionId,
  };
}

function skillFromItemType(itemType: string) {
  if (itemType === "VOCABULARY") return "vocabulary";
  if (itemType === "EXPRESSION") return "expression";
  if (itemType === "GRAMMAR") return "grammar";
  if (itemType === "SENTENCE") return "reading";
  return "general";
}

function skillScoresValue(
  scores: PersonalizedExerciseSources["skillScores"],
  skill: string
) {
  return (scores as Record<string, number>)[skill] ?? 0;
}

export const personalizedExerciseSources =
  new PersonalizedExerciseSourceService();
