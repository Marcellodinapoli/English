import { prisma } from "@/lib/prisma";
import { contentService } from "@/services/content/ContentService";
import {
  spacedRepetition,
  type ReviewGrade,
} from "@/services/learning/SpacedRepetition";
import { adaptiveEngine } from "@/services/learning/AdaptiveEngine";
import type {
  RecordMistakeAndEnqueueInput,
  ReviewEnqueueInput,
  ReviewItemType,
  ReviewQueueItemView,
} from "@/types/review";

const DEFAULT_DUE_MINUTES: Partial<Record<ReviewItemType, number>> = {
  VOCABULARY: 24 * 60,
  EXPRESSION: 24 * 60,
  SENTENCE: 24 * 60,
  GRAMMAR: 4 * 60,
  MISTAKE: 30,
};

function dueFromMinutes(minutes: number): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function mergeMetadata(
  existing: string | null | undefined,
  incoming?: Record<string, unknown>
): string | null {
  if (!incoming || Object.keys(incoming).length === 0) {
    return existing ?? null;
  }
  let base: Record<string, unknown> = {};
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (parsed && typeof parsed === "object") base = parsed;
    } catch {
      base = {};
    }
  }
  return JSON.stringify({ ...base, ...incoming });
}

/**
 * Central enqueue/complete/list API for spaced review.
 * All new ReviewItem writes should go through this service.
 */
export class ReviewQueueService {
  /**
   * Upsert a review queue entry by (userId, itemType, itemId).
   * Existing SM-2 fields are preserved unless masteryScore is explicitly set on create.
   */
  async enqueue(input: ReviewEnqueueInput) {
    const dueMinutes =
      input.dueInMinutes ?? DEFAULT_DUE_MINUTES[input.itemType] ?? 24 * 60;
    const nextReviewAt = dueFromMinutes(dueMinutes);
    const bumpDue = input.bumpDueOnUpdate ?? false;
    const metadata = mergeMetadata(null, input.metadata);

    const existing = await prisma.reviewItem.findUnique({
      where: {
        userId_itemType_itemId: {
          userId: input.userId,
          itemType: input.itemType,
          itemId: input.itemId,
        },
      },
    });

    if (existing) {
      const mergedMeta = mergeMetadata(existing.metadata, input.metadata);
      return prisma.reviewItem.update({
        where: { id: existing.id },
        data: {
          ...(bumpDue ? { nextReviewAt } : {}),
          ...(input.incrementErrorCount
            ? { errorCount: { increment: 1 } }
            : {}),
          ...(input.skill != null ? { skill: input.skill } : {}),
          ...(input.source != null ? { source: input.source } : {}),
          ...(input.lessonId != null ? { lessonId: input.lessonId } : {}),
          ...(input.level != null ? { level: input.level } : {}),
          ...(input.difficulty != null ? { difficulty: input.difficulty } : {}),
          ...(input.context != null ? { context: input.context } : {}),
          ...(input.contentRef != null ? { contentRef: input.contentRef } : {}),
          ...(mergedMeta != null ? { metadata: mergedMeta } : {}),
        },
      });
    }

    return prisma.reviewItem.create({
      data: {
        userId: input.userId,
        itemType: input.itemType,
        itemId: input.itemId,
        nextReviewAt,
        masteryScore: input.masteryScore ?? 0,
        skill: input.skill ?? null,
        source: input.source ?? null,
        lessonId: input.lessonId ?? null,
        level: input.level ?? null,
        difficulty: input.difficulty ?? null,
        errorCount: input.incrementErrorCount ? 1 : 0,
        context: input.context ?? null,
        contentRef: input.contentRef ?? null,
        metadata,
      },
    });
  }

  /**
   * Upsert UserMistake (dedupe by userId+errorType+userInput+unresolved)
   * then enqueue MISTAKE (+ optional GRAMMAR topic) into the queue.
   */
  async recordMistakeAndEnqueue(input: RecordMistakeAndEnqueueInput) {
    const existing = await prisma.userMistake.findFirst({
      where: {
        userId: input.userId,
        errorType: input.errorType,
        userInput: input.userInput,
        resolved: false,
      },
    });

    const mistake = existing
      ? await prisma.userMistake.update({
          where: { id: existing.id },
          data: {
            frequency: { increment: 1 },
            lastSeenAt: new Date(),
            correctForm: input.correctForm,
            context: input.context ?? existing.context,
            skill: input.skill || existing.skill,
          },
        })
      : await prisma.userMistake.create({
          data: {
            userId: input.userId,
            errorType: input.errorType,
            skill: input.skill,
            userInput: input.userInput,
            correctForm: input.correctForm,
            context: input.context,
          },
        });

    const dueInMinutes = input.dueInMinutes ?? DEFAULT_DUE_MINUTES.MISTAKE;
    const reviewItem = await this.enqueue({
      userId: input.userId,
      itemType: "MISTAKE",
      itemId: mistake.id,
      skill: input.skill,
      source: input.source,
      lessonId: input.lessonId,
      level: input.level,
      contentRef: input.contentRef,
      context: input.context,
      dueInMinutes,
      bumpDueOnUpdate: true,
      incrementErrorCount: true,
      metadata: {
        errorType: input.errorType,
        ...input.metadata,
      },
    });

    let grammarItem = null;
    if (input.enqueueGrammarTopic !== false) {
      const topic = contentService.getGrammarByErrorType(input.errorType);
      if (topic) {
        grammarItem = await this.enqueue({
          userId: input.userId,
          itemType: "GRAMMAR",
          itemId: topic.id,
          skill: "grammar",
          source: input.source ?? "mistake",
          lessonId: input.lessonId,
          level: input.level,
          contentRef: input.contentRef ?? topic.id,
          context: input.context,
          dueInMinutes: dueInMinutes ?? DEFAULT_DUE_MINUTES.GRAMMAR,
          bumpDueOnUpdate: true,
          metadata: {
            linkedMistakeId: mistake.id,
            errorType: input.errorType,
          },
        });
      }
    }

    return { mistake, reviewItem, grammarItem };
  }

  /**
   * Apply SM-2 schedule and sync linked vocabulary / mistake rows.
   */
  async complete(userId: string, reviewId: string, grade: ReviewGrade) {
    const item = await prisma.reviewItem.findFirst({
      where: { id: reviewId, userId },
    });
    if (!item) return null;

    const next = spacedRepetition.schedule(
      {
        masteryScore: item.masteryScore,
        interval: item.interval,
        easeFactor: item.easeFactor,
        reviewCount: item.reviewCount,
        nextReviewAt: item.nextReviewAt,
        lastReviewedAt: item.lastReviewedAt,
        lastResult: item.lastResult,
      },
      grade
    );

    const updated = await prisma.reviewItem.update({
      where: { id: item.id },
      data: {
        masteryScore: next.masteryScore,
        interval: next.interval,
        easeFactor: next.easeFactor,
        reviewCount: next.reviewCount,
        nextReviewAt: next.nextReviewAt,
        lastReviewedAt: next.lastReviewedAt,
        lastResult: next.lastResult,
      },
    });

    if (item.itemType === "VOCABULARY") {
      const vocab = await prisma.userVocabulary.findUnique({
        where: { id: item.itemId },
      });
      if (vocab) {
        await prisma.userVocabulary.update({
          where: { id: item.itemId },
          data: {
            masteryScore: next.masteryScore,
            status: spacedRepetition.statusFromMastery(next.masteryScore),
            lastReviewedAt: next.lastReviewedAt,
            nextReviewAt: next.nextReviewAt,
            reviewCount: { increment: 1 },
          },
        });

        const lp = await prisma.learningProfile.findUnique({
          where: { userId },
        });
        if (lp) {
          await prisma.learningProfile.update({
            where: { userId },
            data: {
              vocabularyScore: adaptiveEngine.updateMastery(
                lp.vocabularyScore,
                grade / 5
              ),
            },
          });
        }
      }
    }

    if (item.itemType === "EXPRESSION") {
      const expr = await prisma.userExpression.findUnique({
        where: { id: item.itemId },
      });
      if (expr) {
        await prisma.userExpression.update({
          where: { id: item.itemId },
          data: {
            masteryScore: next.masteryScore,
            status: spacedRepetition.statusFromMastery(next.masteryScore),
            lastReviewedAt: next.lastReviewedAt,
            nextReviewAt: next.nextReviewAt,
            reviewCount: { increment: 1 },
          },
        });

        const lp = await prisma.learningProfile.findUnique({
          where: { userId },
        });
        if (lp) {
          await prisma.learningProfile.update({
            where: { userId },
            data: {
              vocabularyScore: adaptiveEngine.updateMastery(
                lp.vocabularyScore,
                grade / 5
              ),
            },
          });
        }
      }
    }

    if (item.itemType === "GRAMMAR") {
      const lp = await prisma.learningProfile.findUnique({ where: { userId } });
      if (lp) {
        await prisma.learningProfile.update({
          where: { userId },
          data: {
            grammarScore: adaptiveEngine.updateMastery(
              lp.grammarScore,
              grade / 5
            ),
          },
        });
      }
    }

    if (item.itemType === "MISTAKE" && grade >= 4) {
      await prisma.userMistake.update({
        where: { id: item.itemId },
        data: { resolved: true },
      });
    }

    if (item.itemType === "SENTENCE" && grade >= 4) {
      // Sentence side-model optional; SM-2 already applied on ReviewItem
    }

    return updated;
  }

  async listDue(userId: string, take = 20): Promise<{
    items: ReviewQueueItemView[];
    upcomingCount: number;
  }> {
    const now = new Date();
    const due = await prisma.reviewItem.findMany({
      where: { userId, nextReviewAt: { lte: now } },
      orderBy: { nextReviewAt: "asc" },
      take,
    });

    const items: ReviewQueueItemView[] = [];
    for (const item of due) {
      const base: ReviewQueueItemView = {
        reviewId: item.id,
        itemType: item.itemType,
        itemId: item.itemId,
        masteryScore: item.masteryScore,
        skill: item.skill,
        source: item.source,
        lessonId: item.lessonId,
        level: item.level,
        difficulty: item.difficulty,
        errorCount: item.errorCount,
        context: item.context,
        contentRef: item.contentRef,
        createdAt: item.createdAt,
        nextReviewAt: item.nextReviewAt,
      };

      if (item.itemType === "VOCABULARY") {
        const vocab = await prisma.userVocabulary.findUnique({
          where: { id: item.itemId },
        });
        if (vocab) {
          items.push({
            ...base,
            prompt: `What does "${vocab.word}" mean?`,
            word: vocab.word,
            translation: vocab.translation,
            example: vocab.exampleSentence,
            phonetic: vocab.phonetic,
          });
        }
        continue;
      }

      if (item.itemType === "EXPRESSION") {
        const expr = await prisma.userExpression.findUnique({
          where: { id: item.itemId },
        });
        if (expr) {
          items.push({
            ...base,
            prompt: `What does the expression "${expr.expression}" mean?`,
            word: expr.expression,
            expression: expr.expression,
            translation: expr.translation,
            example: expr.example,
            phonetic: expr.phonetic,
            category: expr.category,
            level: base.level || expr.level,
          });
        } else {
          items.push({
            ...base,
            prompt: item.context
              ? `Review expression: ${item.context}`
              : "Review this expression",
            expression: item.context || undefined,
          });
        }
        continue;
      }

      if (item.itemType === "GRAMMAR") {
        const topic = contentService.getGrammar(item.itemId);
        if (topic) {
          items.push({
            ...base,
            prompt: topic.title,
            pattern: topic.pattern,
            examples: topic.examples,
            exercise: topic.exercises[0] || null,
          });
        }
        continue;
      }

      if (item.itemType === "MISTAKE") {
        const mistake = await prisma.userMistake.findUnique({
          where: { id: item.itemId },
        });
        if (mistake) {
          items.push({
            ...base,
            prompt: "Correct this sentence",
            userInput: mistake.userInput,
            correctForm: mistake.correctForm,
            errorType: mistake.errorType,
            skill: base.skill || mistake.skill,
          });
        }
        continue;
      }

      if (item.itemType === "SENTENCE") {
        items.push({
          ...base,
          prompt: item.context
            ? `Review this sentence / meaning`
            : "Review this sentence",
          sentence: item.context || item.contentRef,
          translation: (() => {
            if (!item.metadata) return undefined;
            try {
              const meta = JSON.parse(item.metadata) as {
                translation?: string;
              };
              return meta.translation;
            } catch {
              return undefined;
            }
          })(),
        });
      }
    }

    const upcomingCount = await prisma.reviewItem.count({
      where: { userId, nextReviewAt: { gt: now } },
    });

    return { items, upcomingCount };
  }
}

export const reviewQueue = new ReviewQueueService();
