import type { PartOfSpeech } from "@/types/content";

/** Catalog / content definition for a multi-word expression */
export interface ExpressionDef {
  id: string;
  expression: string;
  translation: string;
  pronunciation?: string;
  phonetic?: string;
  example: string;
  exampleTranslation?: string;
  level: string;
  category: string;
  /** Alternate surface forms that map to this expression */
  aliases?: string[];
  metadata?: Record<string, unknown>;
}

export type ComprehensionQuestionType =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "detail"
  | "main_idea";

export interface ComprehensionQuestion {
  id: string;
  passageId: string;
  question: string;
  type: ComprehensionQuestionType;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  skill?: string;
  topic?: string;
  level: string;
}

export interface ComprehensionSet {
  passageId: string;
  level: string;
  questions: ComprehensionQuestion[];
}

export interface ExpressionPopupData {
  kind: "expression";
  expressionId: string;
  expression: string;
  translation: string;
  pronunciation?: string;
  phonetic?: string;
  example: string;
  exampleTranslation?: string;
  level?: string;
  category?: string;
  sourceContentId?: string;
  masteryScore?: number;
  status?: string;
  inReviewQueue?: boolean;
  saved?: boolean;
}

export interface WordPopupDataV2 {
  kind: "word";
  word: string;
  lemma: string;
  translation: string;
  partOfSpeech: string | PartOfSpeech;
  phonetic?: string;
  example: string;
  exampleTranslation?: string;
  otherMeanings: Array<{ translation: string; partOfSpeech: string }>;
  level?: string;
  sourceContentId?: string;
  masteryScore?: number;
  status?: string;
  inReviewQueue?: boolean;
  saved?: boolean;
}

export type ReadingPopupData = WordPopupDataV2 | ExpressionPopupData;
