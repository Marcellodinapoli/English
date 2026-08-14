export type AIProviderName = "openai" | "stub";

export { getAIConfig, getFunctionConfig, getDefaultChatModel } from "./config";
export type { AIFunctionName, AIFunctionConfig, AIConfig } from "./config";

import type {
  ConversationEvaluation,
  ConversationEvaluationRequest,
  RoleplayResponseRequest,
  RoleplayResponseResult,
  TutorResponseRequest,
  TutorResponseResult,
} from "@/types/conversation";

export type {
  ConversationEvaluation,
  ConversationEvaluationRequest,
  RoleplayResponseRequest,
  RoleplayResponseResult,
  TutorResponseRequest,
  TutorResponseResult,
};

export interface ContextualMeaningRequest {
  word: string;
  sentence: string;
  lemma?: string;
  pos?: string;
  annotatedTranslation?: string;
  otherMeanings?: Array<{ translation: string; partOfSpeech: string }>;
  level?: string;
}

export interface ContextualMeaningResult {
  word: string;
  translation: string;
  partOfSpeech: string;
  phonetic?: string;
  example: string;
  exampleTranslation?: string;
  otherMeanings: Array<{ translation: string; partOfSpeech: string }>;
  source: "annotation" | "ai" | "fallback";
}

export interface SpeakingEvaluationRequest {
  transcript: string;
  expectedText?: string;
  mode: "repeat" | "free";
  prompt?: string;
  level?: string;
  durationMs?: number;
}

export interface SpeakingEvaluationResult {
  transcript: string;
  overall: number;
  /** Omitted when no real phonetic/audio analysis was performed */
  pronunciation?: number;
  accuracy: number;
  fluency: number;
  vocabulary: number;
  grammar: number;
  transcriptQuality?: number;
  feedback: string;
  suggestions: string[];
  corrections?: Array<{
    from: string;
    to: string;
    reason: string;
    type?: string;
    topic?: string;
  }>;
  source: "ai" | "heuristic";
  /** True only when pronunciation was assessed via real phonetic analysis */
  pronunciationAssessed?: boolean;
}

export interface WritingEvaluationRequest {
  text: string;
  prompt: string;
  level?: string;
  expectedHints?: string[];
}

export interface WritingEvaluationResult {
  overall: number;
  grammar: number;
  vocabulary: number;
  accuracy: number;
  fluency: number;
  feedback: string;
  suggestions: string[];
  correctedText?: string;
  mistakes: Array<{
    original: string;
    correction: string;
    type: string;
    topic?: string;
    skill?: "grammar" | "vocabulary" | "writing" | "speaking" | "reading";
  }>;
  source: "ai" | "heuristic";
}

export interface AIProvider {
  readonly name: AIProviderName;
  getContextualMeaning(
    request: ContextualMeaningRequest
  ): Promise<ContextualMeaningResult>;
  generateExplanation?(topic: string, level: string): Promise<string>;
  evaluateSpeaking?(
    request: SpeakingEvaluationRequest
  ): Promise<SpeakingEvaluationResult>;
  evaluateWriting?(
    request: WritingEvaluationRequest
  ): Promise<WritingEvaluationResult>;
  transcribeAudio?(audio: Buffer, mimeType: string): Promise<string>;
  generateTutorResponse?(
    request: TutorResponseRequest
  ): Promise<TutorResponseResult>;
  generateRoleplayResponse?(
    request: RoleplayResponseRequest
  ): Promise<RoleplayResponseResult>;
  evaluateConversation?(
    request: ConversationEvaluationRequest
  ): Promise<ConversationEvaluation>;
}
