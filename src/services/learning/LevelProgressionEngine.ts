import { prisma } from "@/lib/prisma";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { contentService } from "@/services/content/ContentService";
import {
  levelBaseSubLevel,
  nextLevel as getNextCefrLevel,
  canAccessLevel as userCanAccessLevel,
} from "@/lib/cefr";
import { LEVEL_PROGRESSION_THRESHOLDS } from "@/lib/levelProgressionThresholds";

import type { CEFRLevel } from "@/types/learning";

export { LEVEL_PROGRESSION_THRESHOLDS } from "@/lib/levelProgressionThresholds";

export interface LevelProgressionResult {
  currentLevel: CEFRLevel;
  subLevel: number;
  promoted: boolean;
  previousLevel?: CEFRLevel;
  lessonsCompletedInLevel: number;
  lessonsTotalInLevel: number;
  levelProgressPercent: number;
  readyToPromote: boolean;
  averageMastery: number;
  blockers: string[];
}

type ProgressionState = {
  currentLevel: CEFRLevel;
  stats: Awaited<ReturnType<LevelProgressionEngine["getLevelLessonStats"]>>;
  avgMastery: number;
  blockers: string[];
  subLevel: number;
  readyToPromote: boolean;
  next: CEFRLevel | null;
};

export class LevelProgressionEngine {
  levelBase(level: string): number {
    return levelBaseSubLevel(level);
  }

  nextLevel(level: string): CEFRLevel | null {
    return getNextCefrLevel(level);
  }

  canAccessLevel(userLevel: string, targetLevel: string): boolean {
    return userCanAccessLevel(userLevel, targetLevel);
  }

  getThresholds() {
    return LEVEL_PROGRESSION_THRESHOLDS;
  }

  private averageCoreMastery(scores: {
    vocabularyScore: number;
    grammarScore: number;
    readingScore: number;
    listeningScore: number;
  }) {
    return (
      (scores.vocabularyScore +
        scores.grammarScore +
        scores.readingScore +
        scores.listeningScore) /
      4
    );
  }

  async getLevelLessonStats(userId: string, levelId: string) {
    const level = contentService.getLevel(levelId);
    if (!level) {
      return {
        completed: 0,
        total: 0,
        ratio: 0,
        lessonIds: [] as string[],
        averageScore: null as number | null,
        strugglingCount: 0,
      };
    }

    const lessonIds = level.units.flatMap((u) => u.lessons.map((l) => l.id));
    const rows = await prisma.lessonProgress.findMany({
      where: {
        userId,
        lessonId: { in: lessonIds },
        status: "COMPLETED",
      },
      select: { score: true, outcome: true },
    });

    const scored = rows.filter((r) => r.score != null);
    const averageScore = scored.length
      ? scored.reduce((s, r) => s + (r.score || 0), 0) / scored.length
      : null;
    const strugglingCount = rows.filter(
      (r) => r.outcome === "struggling"
    ).length;

    return {
      completed: rows.length,
      total: lessonIds.length,
      ratio: lessonIds.length ? rows.length / lessonIds.length : 0,
      lessonIds,
      averageScore,
      strugglingCount,
    };
  }

  computeSubLevel(level: string, ratio: number): number {
    const base = this.levelBase(level);
    const span = level === "ZERO" ? 0.8 : 0.9;
    return Math.round((base + ratio * span) * 10) / 10;
  }

  /**
   * Read-only progression status (same rules as evaluate, no DB writes / no promote).
   */
  async getStatus(userId: string): Promise<LevelProgressionResult> {
    const state = await this.computeState(userId);
    return {
      currentLevel: state.currentLevel,
      subLevel: state.subLevel,
      promoted: false,
      lessonsCompletedInLevel: state.stats.completed,
      lessonsTotalInLevel: state.stats.total,
      levelProgressPercent: Math.round(state.stats.ratio * 100),
      readyToPromote: state.readyToPromote,
      averageMastery: Math.round(state.avgMastery * 10) / 10,
      blockers: state.blockers,
    };
  }

  private async computeState(userId: string): Promise<ProgressionState> {
    const lp = await prisma.learningProfile.findUnique({ where: { userId } });
    if (!lp) {
      throw new Error("Learning profile not found");
    }

    const t = LEVEL_PROGRESSION_THRESHOLDS;
    const currentLevel = lp.currentLevel as CEFRLevel;
    const stats = await this.getLevelLessonStats(userId, currentLevel);
    const avgMastery = this.averageCoreMastery(lp);
    const blockers: string[] = [];

    const coreScores = [
      lp.vocabularyScore,
      lp.grammarScore,
      lp.readingScore,
      lp.listeningScore,
    ];
    const minCore = Math.min(...coreScores);

    const repeatedMistakes = await prisma.userMistake.count({
      where: {
        userId,
        resolved: false,
        frequency: { gte: 2 },
      },
    });

    const dueReviews = await prisma.reviewItem.count({
      where: { userId, nextReviewAt: { lte: new Date() } },
    });

    if (stats.total === 0 || stats.ratio < 1) {
      blockers.push("Complete all lessons in this level");
    }
    if (avgMastery < t.masteryMin) {
      blockers.push(
        `Average mastery ${Math.round(avgMastery)}% (need ${t.masteryMin}%+)`
      );
    }
    if (minCore < t.skillFloor) {
      blockers.push(`A core skill is below ${t.skillFloor}%`);
    }
    if (repeatedMistakes > t.maxRepeatedMistakes) {
      blockers.push(
        `${repeatedMistakes} repeated unresolved mistakes (max ${t.maxRepeatedMistakes})`
      );
    }
    if (dueReviews >= t.maxDueReviews) {
      blockers.push(`${dueReviews} overdue reviews — clear the queue first`);
    }
    if (stats.averageScore != null && stats.averageScore < t.minAvgLessonScore) {
      blockers.push(
        `Average lesson score ${Math.round(stats.averageScore)}% (need ${t.minAvgLessonScore}%+)`
      );
    }
    if (stats.strugglingCount >= t.maxStrugglingLessons) {
      blockers.push(
        `${stats.strugglingCount} lessons completed with difficulty`
      );
    }

    let subLevel = this.computeSubLevel(currentLevel, stats.ratio);
    if (avgMastery < t.masteryMin) {
      const cappedRatio = Math.min(stats.ratio, 0.85);
      subLevel = this.computeSubLevel(currentLevel, cappedRatio);
    }

    const next = this.nextLevel(currentLevel);
    const readyToPromote = blockers.length === 0 && Boolean(next);

    return {
      currentLevel,
      stats,
      avgMastery,
      blockers,
      subLevel,
      readyToPromote,
      next,
    };
  }

  async evaluate(userId: string): Promise<LevelProgressionResult> {
    const state = await this.computeState(userId);

    let promoted = false;
    let previousLevel: CEFRLevel | undefined;
    let newLevel = state.currentLevel;
    let subLevel = state.subLevel;

    if (state.readyToPromote && state.next) {
      promoted = true;
      previousLevel = state.currentLevel;
      newLevel = state.next;
      subLevel = this.levelBase(state.next);
    }

    await prisma.learningProfile.update({
      where: { userId },
      data: {
        currentLevel: newLevel,
        subLevel,
      },
    });

    if (promoted && previousLevel) {
      await analyticsService.track(userId, "level_promoted", {
        from: previousLevel,
        to: newLevel,
        averageMastery: Math.round(state.avgMastery),
      });
      await prisma.userProgress.update({
        where: { userId },
        data: { xp: { increment: 100 } },
      });
    }

    return {
      currentLevel: newLevel,
      subLevel,
      promoted,
      previousLevel,
      lessonsCompletedInLevel: state.stats.completed,
      lessonsTotalInLevel: state.stats.total,
      levelProgressPercent: Math.round(state.stats.ratio * 100),
      readyToPromote: state.readyToPromote,
      averageMastery: Math.round(state.avgMastery * 10) / 10,
      blockers: state.blockers,
    };
  }
}

export const levelProgressionEngine = new LevelProgressionEngine();
