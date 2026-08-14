export type SpeakingMode = "repeat" | "free";

export interface SpeakingItem {
  id: string;
  mode: SpeakingMode;
  prompt: string;
  promptIt?: string;
  targetText?: string;
  exampleAnswer?: string;
  hint?: string;
}

export interface SpeakingContent {
  id: string;
  title: string;
  titleIt?: string;
  level: string;
  description?: string;
  estimatedMinutes: number;
  items: SpeakingItem[];
}

export interface WritingItem {
  id: string;
  prompt: string;
  promptIt?: string;
  minWords?: number;
  hints?: string[];
}

export interface WritingContent {
  id: string;
  title: string;
  titleIt?: string;
  level: string;
  description?: string;
  estimatedMinutes: number;
  items: WritingItem[];
}
