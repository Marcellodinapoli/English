import {
  CEFR_ORDER,
  canAccessLevel,
  levelIndex,
  normalizeLevel,
} from "@/lib/cefr";
import type { CEFRLevel } from "@/types/learning";

/** Highest CEFR band included in the Free plan. */
export const FREE_MAX_CONTENT_LEVEL: CEFRLevel = "A1";

export const PREMIUM_UPGRADE_HREF = "/subscription";

export type ContentAccessReason =
  | "ok"
  | "premium_required"
  | "progression";

export interface ContentAccessInput {
  /** Plan: true = PREMIUM and unexpired */
  isPremium: boolean;
  /** Level the user has actually reached (unchanged by paywall). */
  userLevel?: string | null;
  /** CEFR of the content being opened (lesson.levelId, passage.level, …). */
  contentLevel: string;
  /**
   * When true, also require canAccessLevel(userLevel, contentLevel).
   * Used for lessons. Catalogs use paywall only.
   */
  enforceProgression?: boolean;
}

export interface ContentAccessDecision {
  allowed: boolean;
  reason: ContentAccessReason;
  userLevel: string | null;
  contentLevel: string;
  contentBand: CEFRLevel;
  isPremium: boolean;
  upgradeHref?: string;
  message?: string;
}

/**
 * Map stored level strings (A1, A1.1, a2-u1) onto a CEFR band.
 */
export function contentLevelBand(raw: string | null | undefined): CEFRLevel {
  if (!raw) return "ZERO";
  const upper = raw.toUpperCase();
  if (upper.startsWith("ZERO")) return "ZERO";
  for (const level of CEFR_ORDER) {
    if (level === "ZERO") continue;
    if (upper === level || upper.startsWith(level)) return level;
  }
  return normalizeLevel(raw);
}

export function isPremiumRequiredForLevel(
  contentLevel: string | null | undefined
): boolean {
  return (
    levelIndex(contentLevelBand(contentLevel)) >
    levelIndex(FREE_MAX_CONTENT_LEVEL)
  );
}

/**
 * Band Daily Plan should pick catalog/lesson content from.
 * Premium: the user's reached level. Free: min(reached, A1).
 */
export function maxAccessibleContentLevel(
  isPremium: boolean,
  userLevel: string | null | undefined
): CEFRLevel {
  const reached = contentLevelBand(userLevel);
  if (isPremium) return reached;
  return levelIndex(reached) <= levelIndex(FREE_MAX_CONTENT_LEVEL)
    ? reached
    : FREE_MAX_CONTENT_LEVEL;
}

/**
 * Central authorization: reached level × content level × plan.
 * Does not mutate currentLevel or mastery.
 */
export function authorizeContentAccess(
  input: ContentAccessInput
): ContentAccessDecision {
  const contentBand = contentLevelBand(input.contentLevel);
  const userLevel = input.userLevel ?? null;
  const base = {
    userLevel,
    contentLevel: input.contentLevel,
    contentBand,
    isPremium: input.isPremium,
  };

  if (isPremiumRequiredForLevel(input.contentLevel) && !input.isPremium) {
    return {
      ...base,
      allowed: false,
      reason: "premium_required",
      upgradeHref: PREMIUM_UPGRADE_HREF,
      message: "A2–C1 content requires Premium.",
    };
  }

  if (
    input.enforceProgression &&
    userLevel &&
    !canAccessLevel(userLevel, contentBand)
  ) {
    return {
      ...base,
      allowed: false,
      reason: "progression",
      message: `Complete level ${userLevel} before starting ${contentBand} lessons.`,
    };
  }

  return {
    ...base,
    allowed: true,
    reason: "ok",
  };
}

export function catalogLockMeta(
  isPremium: boolean,
  contentLevel: string | null | undefined
): { locked: boolean; premiumRequired: boolean } {
  const premiumRequired = isPremiumRequiredForLevel(contentLevel);
  return {
    premiumRequired,
    locked: premiumRequired && !isPremium,
  };
}
