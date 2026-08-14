/**
 * Single source of truth for CEFR level promotion thresholds.
 * Used by LevelProgressionEngine, APIs, and UI copy — do not duplicate magic numbers.
 */
export const LEVEL_PROGRESSION_THRESHOLDS = {
  /** Average of vocabulary + grammar + reading + listening */
  masteryMin: 65,
  /** Minimum any single core skill may sit at */
  skillFloor: 45,
  /** Unresolved mistakes with frequency >= 2 above this count block promotion */
  maxRepeatedMistakes: 2,
  /** Average lesson score in the current level (when scores exist) */
  minAvgLessonScore: 60,
  /** Overdue review items at or above this count block promotion */
  maxDueReviews: 15,
  /** Lessons completed with outcome "struggling" at or above this block promotion */
  maxStrugglingLessons: 2,
} as const;

export type LevelProgressionThresholds = typeof LEVEL_PROGRESSION_THRESHOLDS;
