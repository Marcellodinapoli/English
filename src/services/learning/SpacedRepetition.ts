export type ReviewGrade = 0 | 1 | 2 | 3 | 4 | 5;

export interface SpacedItemState {
  masteryScore: number;
  interval: number;
  easeFactor: number;
  reviewCount: number;
  nextReviewAt: Date;
  lastReviewedAt?: Date | null;
  lastResult?: boolean | null;
}

/**
 * SM-2 inspired spaced repetition with mastery score.
 * Wrong answers shrink interval; stable mastery expands it.
 */
export class SpacedRepetition {
  schedule(
    state: SpacedItemState,
    grade: ReviewGrade
  ): SpacedItemState {
    const now = new Date();
    const correct = grade >= 3;
    let { interval, easeFactor, masteryScore } = state;
    const { reviewCount } = state;

    easeFactor = Math.max(
      1.3,
      easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
    );

    if (!correct) {
      interval = 1;
      masteryScore = Math.max(0, masteryScore - 15);
    } else if (reviewCount === 0) {
      interval = 1;
      masteryScore = Math.min(100, masteryScore + 12);
    } else if (reviewCount === 1) {
      interval = 3;
      masteryScore = Math.min(100, masteryScore + 14);
    } else {
      interval = Math.max(1, Math.round(interval * easeFactor));
      masteryScore = Math.min(100, masteryScore + 8 + grade);
    }

    const nextReviewAt = new Date(now);
    nextReviewAt.setDate(nextReviewAt.getDate() + interval);

    return {
      masteryScore: Math.round(masteryScore * 10) / 10,
      interval,
      easeFactor: Math.round(easeFactor * 100) / 100,
      reviewCount: reviewCount + 1,
      nextReviewAt,
      lastReviewedAt: now,
      lastResult: correct,
    };
  }

  statusFromMastery(mastery: number): "NEW" | "LEARNING" | "FAMILIAR" | "MASTERED" {
    if (mastery < 20) return "NEW";
    if (mastery < 50) return "LEARNING";
    if (mastery < 80) return "FAMILIAR";
    return "MASTERED";
  }
}

export const spacedRepetition = new SpacedRepetition();