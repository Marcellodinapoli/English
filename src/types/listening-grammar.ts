import type { PartOfSpeech, ExerciseItem } from "./content";

export type ListeningExerciseType =
  | "listen_choose"
  | "listen_complete"
  | "listen_write"
  | "listen_order"
  | "listen_identify"
  | "dictation"
  | "comprehension";

export interface ListeningItem {
  id: string;
  type: ListeningExerciseType;
  prompt: string;
  promptIt?: string;
  transcript: string;
  options?: string[];
  answer: string | string[];
  explanation?: string;
}

export interface ListeningContent {
  id: string;
  title: string;
  titleIt?: string;
  level: string;
  description?: string;
  audioText: string;
  estimatedMinutes: number;
  items: ListeningItem[];
}

export interface GrammarTopic {
  id: string;
  level: string;
  title: string;
  titleIt?: string;
  examples: string[];
  pattern: string;
  explanation: string;
  explanationIt?: string;
  realUse: string[];
  exercises: ExerciseItem[];
  relatedErrorTypes?: string[];
}

// Re-export for convenience in grammar/listening modules
export type { PartOfSpeech, ExerciseItem };