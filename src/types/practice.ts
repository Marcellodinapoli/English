import type { ExerciseItem } from "@/types/content";
import type { ReviewItemType } from "@/types/review";

export type ExerciseTargetKind =
  | "due_review"
  | "repeated_mistake"
  | "low_mastery_word"
  | "low_mastery_expression"
  | "grammar_weakness"
  | "skill_weakness"
  | "new_content"
  | "recent_save";

export type PedagogicalExerciseType =
  | "multiple_choice"
  | "true_false"
  | "fill_blank"
  | "matching"
  | "translation"
  | "sentence_completion"
  | "vocabulary_in_context"
  | "expression_in_context"
  | "grammar_correction"
  | "reading_comprehension";

export type ExerciseProviderId = "rule" | "ai";

export interface RankedExerciseTarget {
  id: string;
  kind: ExerciseTargetKind;
  priority: number;
  reasons: string[];
  itemType: ReviewItemType | "SKILL" | "CONTENT";
  itemId: string;
  skill: string;
  label: string;
  masteryScore?: number;
  errorCount?: number;
  frequency?: number;
  due?: boolean;
  hoursOverdue?: number;
  reviewId?: string;
  level?: string;
  payload: Record<string, unknown>;
}

export interface PersonalizedExercise {
  id: string;
  provider: ExerciseProviderId;
  pedagogicalType: PedagogicalExerciseType;
  exercise: ExerciseItem;
  target: RankedExerciseTarget;
}

export interface ExerciseGenerationContext {
  userId: string;
  userLevel: string;
  targets: RankedExerciseTarget[];
  count: number;
}

export interface ExerciseProvider {
  readonly id: ExerciseProviderId;
  generate(ctx: ExerciseGenerationContext): Promise<PersonalizedExercise[]>;
}
