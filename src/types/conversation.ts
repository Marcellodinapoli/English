export type RoleplayCategory = "travel" | "work" | "daily" | "social";

export type ConversationType = "tutor" | "roleplay";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  hint?: string;
}

export interface RoleplayScenario {
  id: string;
  title: string;
  titleIt: string;
  category: RoleplayCategory;
  level: string;
  description: string;
  descriptionIt: string;
  setting: string;
  yourRole: string;
  aiRole: string;
  aiCharacter: string;
  goals: string[];
  openingLine: string;
  suggestedPhrases: string[];
  maxTurns: number;
  estimatedMinutes: number;
}

export interface TutorContext {
  level: string;
  subLevel: number;
  weakSkills: string[];
  problematicGrammar: string[];
  goal?: string;
}

export interface TutorResponseRequest {
  messages: ConversationMessage[];
  userMessage: string;
  context: TutorContext;
}

export interface TutorResponseResult {
  message: string;
  hint?: string;
  encouragement?: string;
  source: "ai" | "heuristic";
}

export interface RoleplayResponseRequest {
  messages: ConversationMessage[];
  userMessage: string;
  scenario: RoleplayScenario;
  level: string;
}

export interface RoleplayResponseResult {
  message: string;
  sceneNote?: string;
  source: "ai" | "heuristic";
}

export interface ConversationEvaluationRequest {
  type: ConversationType;
  messages: ConversationMessage[];
  level: string;
  scenario?: RoleplayScenario;
}

export interface ConversationEvaluation {
  overall: number;
  grammar: number;
  vocabulary: number;
  fluency: number;
  feedback: string;
  grammarErrors: Array<{
    original: string;
    correction: string;
    explanation: string;
    type?: string;
    topic?: string;
  }>;
  vocabularyNotes: string[];
  recommendations: string[];
  reviewTopics: string[];
  source: "ai" | "heuristic";
}
