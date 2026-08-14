import { FREE_MAX_CONTENT_LEVEL } from "@/lib/contentAccess";
import { levelBaseSubLevel, levelIndex, normalizeLevel } from "@/lib/cefr";
import type { CEFRLevel } from "@/types/learning";

/**
 * Free plan placement may not exceed FREE_MAX_CONTENT_LEVEL (A1).
 * Premium keeps the raw assessment band. Does not touch LevelProgressionEngine.
 */
export function clampAssessmentLevelForPlan(
  determined: { level: string; subLevel: number },
  isPremium: boolean
): { level: CEFRLevel; subLevel: number } {
  const level = normalizeLevel(determined.level);
  if (isPremium) {
    return { level, subLevel: determined.subLevel };
  }
  if (levelIndex(level) <= levelIndex(FREE_MAX_CONTENT_LEVEL)) {
    return { level, subLevel: determined.subLevel };
  }
  // Strong Free result → top of Free band (A1), not A2+
  return {
    level: FREE_MAX_CONTENT_LEVEL,
    subLevel: Math.max(1.3, levelBaseSubLevel(FREE_MAX_CONTENT_LEVEL) + 0.3),
  };
}
