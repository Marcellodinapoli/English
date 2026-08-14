import { achievementEngine } from "@/services/gamification/AchievementEngine";
import type { AchievementDefinition } from "@/types/gamification";

/**
 * Run after learning activities that may unlock achievements.
 */
export async function processGamification(userId: string): Promise<{
  newlyUnlocked: AchievementDefinition[];
  xpGranted: number;
}> {
  return achievementEngine.checkAndUnlock(userId);
}
