import { prisma } from "@/lib/prisma";
import type {
  AchievementCondition,
  AchievementDefinition,
  MilestoneDefinition,
  MilestoneProgressDTO,
} from "@/types/gamification";
import { getAchievementCatalog } from "./achievementCatalog";

export interface UnlockResult {
  newlyUnlocked: AchievementDefinition[];
  xpGranted: number;
}

const LEVEL_ORDER = ["ZERO", "A1", "A2", "B1", "B2", "C1"];

function levelIndex(level: string) {
  const idx = LEVEL_ORDER.indexOf(level.toUpperCase());
  return idx >= 0 ? idx : 0;
}

export class AchievementEngine {
  private async getStats(userId: string) {
    const [progress, reviewEvents, unlocked] = await Promise.all([
      prisma.userProgress.findUnique({ where: { userId } }),
      prisma.analyticsEvent.count({
        where: { userId, event: "word_reviewed" },
      }),
      prisma.userAchievement.findMany({
        where: { userId },
        select: { achievementId: true },
      }),
    ]);

    const eventCounts = await prisma.analyticsEvent.groupBy({
      by: ["event"],
      where: { userId },
      _count: { event: true },
    });

    const events: Record<string, number> = {};
    for (const row of eventCounts) {
      events[row.event] = row._count.event;
    }

    return {
      progress,
      reviewEvents,
      unlockedIds: new Set(unlocked.map((u) => u.achievementId)),
      events,
    };
  }

  private meetsCondition(
    condition: AchievementCondition,
    stats: Awaited<ReturnType<AchievementEngine["getStats"]>>
  ): boolean {
    const p = stats.progress;
    if (!p) return false;

    switch (condition.type) {
      case "lessons_completed":
        return p.lessonsCompleted >= condition.value;
      case "words_learned":
        return p.wordsLearned >= condition.value;
      case "reviews_completed":
        return stats.reviewEvents >= condition.value;
      case "streak":
        return p.streak >= condition.value;
      case "xp":
        return p.xp >= condition.value;
      case "event_count":
        return (stats.events[condition.event] || 0) >= condition.value;
      default:
        return false;
    }
  }

  async checkAndUnlock(userId: string): Promise<UnlockResult> {
    const stats = await this.getStats(userId);
    const { achievements } = getAchievementCatalog();
    const newlyUnlocked: AchievementDefinition[] = [];
    let xpGranted = 0;

    for (const achievement of achievements) {
      if (stats.unlockedIds.has(achievement.id)) continue;
      if (!this.meetsCondition(achievement.condition, stats)) continue;

      try {
        await prisma.userAchievement.create({
          data: {
            userId,
            achievementId: achievement.id,
          },
        });
      } catch (error) {
        // Concurrent unlock or duplicate — unique(userId, achievementId)
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code: unknown }).code)
            : "";
        if (code === "P2002") continue;
        throw error;
      }

      stats.unlockedIds.add(achievement.id);
      newlyUnlocked.push(achievement);
      xpGranted += achievement.xpReward;
    }

    if (xpGranted > 0) {
      await prisma.userProgress.update({
        where: { userId },
        data: { xp: { increment: xpGranted } },
      });
    }

    return { newlyUnlocked, xpGranted };
  }

  async getUserAchievements(userId: string) {
    const { achievements } = getAchievementCatalog();
    const unlocked = await prisma.userAchievement.findMany({
      where: { userId },
      orderBy: { unlockedAt: "desc" },
    });
    const unlockedMap = new Map(
      unlocked.map((u) => [u.achievementId, u.unlockedAt.toISOString()])
    );

    return achievements.map((achievement) => ({
      achievement,
      unlocked: unlockedMap.has(achievement.id),
      unlockedAt: unlockedMap.get(achievement.id) || null,
    }));
  }

  getMilestoneProgress(
    milestones: MilestoneDefinition[],
    data: {
      level: string;
      streak: number;
      xp: number;
      studyMinutes: number;
    }
  ): MilestoneProgressDTO[] {
    return milestones
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((milestone) => {
        let progress = 0;
        let target = 1;
        let reached = false;

        switch (milestone.type) {
          case "level":
            progress = levelIndex(data.level);
            target = levelIndex(String(milestone.value));
            reached = progress >= target;
            break;
          case "streak":
            progress = data.streak;
            target = Number(milestone.value);
            reached = progress >= target;
            break;
          case "xp":
            progress = data.xp;
            target = Number(milestone.value);
            reached = progress >= target;
            break;
          case "study_minutes":
            progress = data.studyMinutes;
            target = Number(milestone.value);
            reached = progress >= target;
            break;
        }

        return {
          milestone,
          reached,
          progress: Math.min(progress, target),
          target,
        };
      });
  }
}

export const achievementEngine = new AchievementEngine();
