/**
 * Central review queue types (Phase 0).
 * Maps user-facing kinds to persisted ReviewItem.itemType values.
 */

export type ReviewItemType =
  | "VOCABULARY"
  | "EXPRESSION"
  | "GRAMMAR"
  | "MISTAKE"
  | "SENTENCE";

/** User-facing aliases → persisted itemType */
export type ReviewKind =
  | "word"
  | "expression"
  | "grammar"
  | "mistake"
  | "sentence";

export type ReviewSkill =
  | "vocabulary"
  | "grammar"
  | "reading"
  | "listening"
  | "speaking"
  | "writing"
  | "pronunciation"
  | "expression"
  | "general";

export const REVIEW_KIND_TO_TYPE: Record<ReviewKind, ReviewItemType> = {
  word: "VOCABULARY",
  expression: "EXPRESSION",
  grammar: "GRAMMAR",
  mistake: "MISTAKE",
  sentence: "SENTENCE",
};

export interface ReviewEnqueueInput {
  userId: string;
  itemType: ReviewItemType;
  itemId: string;
  skill?: ReviewSkill | string;
  /** Reference to original content (text id, exercise id, etc.) */
  contentRef?: string;
  lessonId?: string;
  level?: string;
  source?: string;
  context?: string;
  difficulty?: number;
  masteryScore?: number;
  /** Minutes until due; used on create, and on update when bumpDueOnUpdate */
  dueInMinutes?: number;
  /** When true, refresh nextReviewAt on existing items (default: true for mistakes) */
  bumpDueOnUpdate?: boolean;
  /** Increment errorCount (default false; true for mistake re-occurrence) */
  incrementErrorCount?: boolean;
  /** Extra JSON-serializable fields */
  metadata?: Record<string, unknown>;
}

export interface RecordMistakeAndEnqueueInput {
  userId: string;
  errorType: string;
  skill: ReviewSkill | string;
  userInput: string;
  correctForm: string;
  context?: string;
  lessonId?: string;
  level?: string;
  source?: string;
  contentRef?: string;
  /** Also enqueue linked GRAMMAR topic when ErrorEngine maps one (default true) */
  enqueueGrammarTopic?: boolean;
  dueInMinutes?: number;
  metadata?: Record<string, unknown>;
}

export interface ReviewQueueItemView {
  reviewId: string;
  itemType: ReviewItemType | string;
  itemId: string;
  masteryScore: number;
  skill?: string | null;
  source?: string | null;
  lessonId?: string | null;
  level?: string | null;
  difficulty?: number | null;
  errorCount?: number;
  context?: string | null;
  contentRef?: string | null;
  createdAt?: Date | string | null;
  nextReviewAt?: Date | string;
  prompt?: string;
  [key: string]: unknown;
}
