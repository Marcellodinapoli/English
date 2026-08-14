export type PartOfSpeech =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "pronoun"
  | "preposition"
  | "conjunction"
  | "interjection"
  | "determiner"
  | "proper noun"
  | "number"
  | "article"
  | "other";

export interface WordMeaning {
  translation: string;
  partOfSpeech: PartOfSpeech;
  note?: string;
}

export interface ContentToken {
  word: string;
  lemma: string;
  pos: PartOfSpeech;
  phonetic?: string;
  pronunciation?: string;
  meanings: WordMeaning[];
  /** Index of contextual meaning for this sentence */
  contextualMeaningIndex?: number;
  isPunctuation?: boolean;
}

export interface ContentSentence {
  id: string;
  text: string;
  translation?: string;
  audioUrl?: string;
  tokens: ContentToken[];
}

export interface PassageContent {
  id: string;
  type: "passage";
  level: string;
  title: string;
  titleIt?: string;
  description?: string;
  sentences: ContentSentence[];
  vocabularyFocus?: string[];
  grammarFocus?: string[];
}

export interface VocabItem {
  word: string;
  lemma: string;
  translation: string;
  partOfSpeech: PartOfSpeech;
  phonetic?: string;
  example: string;
  exampleTranslation: string;
}

export interface ExerciseItem {
  id: string;
  type: "multiple_choice" | "fill_blank" | "match" | "reorder";
  prompt: string;
  promptIt?: string;
  options?: string[];
  answer: string | string[];
  explanation?: string;
}

export interface LessonStepDef {
  id: string;
  type:
    | "introduction"
    | "vocabulary"
    | "listening"
    | "reading"
    | "comprehension"
    | "grammar"
    | "exercise"
    | "speaking"
    | "review";
  contentRef: string;
  required?: boolean;
  title?: string;
}

export interface LessonContent {
  id: string;
  unitId: string;
  levelId: string;
  title: string;
  titleIt?: string;
  description?: string;
  estimatedMinutes: number;
  steps: LessonStepDef[];
  introduction?: {
    headline: string;
    body: string;
    bodyIt?: string;
    objectives: string[];
  };
  vocabulary?: VocabItem[];
  readingRef?: string;
  grammar?: {
    examples: string[];
    pattern: string;
    explanation: string;
    explanationIt?: string;
  };
  exercises?: ExerciseItem[];
  review?: {
    summary: string[];
    tip?: string;
  };
}

export interface UnitMeta {
  id: string;
  levelId: string;
  title: string;
  titleIt?: string;
  description?: string;
  order: number;
  lessons: { id: string; title: string; order: number }[];
}

export interface LevelMeta {
  id: string;
  name: string;
  label: string;
  description: string;
  order: number;
  units: UnitMeta[];
}