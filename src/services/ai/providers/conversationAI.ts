import type {
  ConversationEvaluation,
  ConversationEvaluationRequest,
  RoleplayResponseRequest,
  RoleplayResponseResult,
  TutorResponseRequest,
  TutorResponseResult,
} from "@/types/conversation";
import { chatJsonValidated } from "../aiCall";
import { getFunctionConfig } from "../config";
import { evaluateConversationPrompt } from "../prompts/evaluateConversation";
import { roleplayResponsePrompt } from "../prompts/roleplay";
import { tutorResponsePrompt } from "../prompts/tutor";
import {
  conversationEvaluationSchema,
  roleplayResponseSchema,
  tutorResponseSchema,
} from "../schemas";
import {
  heuristicConversationEvaluation,
  heuristicRoleplayResponse,
  heuristicTutorResponse,
} from "../heuristics/conversation";

export async function generateTutorResponseOpenAI(
  client: import("openai").default,
  request: TutorResponseRequest,
  userId?: string | null
): Promise<TutorResponseResult> {
  void client;
  try {
    const result = await chatJsonValidated({
      fn: "tutor",
      system:
        "You are Alinea, a professional English tutor. Return strict JSON only.",
      user: tutorResponsePrompt(request),
      schema: tutorResponseSchema,
      userId,
    });
    return {
      message: result.data.message,
      hint: result.data.hint,
      encouragement: result.data.encouragement,
      source: "ai",
    };
  } catch {
    return heuristicTutorResponse(request);
  }
}

export async function generateRoleplayResponseOpenAI(
  client: import("openai").default,
  request: RoleplayResponseRequest,
  userId?: string | null
): Promise<RoleplayResponseResult> {
  void client;
  try {
    const result = await chatJsonValidated({
      fn: "roleplay",
      system:
        "You are an English role-play character for learners. Return strict JSON only.",
      user: roleplayResponsePrompt(request),
      schema: roleplayResponseSchema,
      userId,
    });
    return {
      message: result.data.message,
      sceneNote: result.data.sceneNote,
      source: "ai",
    };
  } catch {
    return heuristicRoleplayResponse(request);
  }
}

export async function evaluateConversationOpenAI(
  client: import("openai").default,
  request: ConversationEvaluationRequest,
  userId?: string | null
): Promise<ConversationEvaluation> {
  void client;
  try {
    const result = await chatJsonValidated({
      fn: "conversation_eval",
      system: "You are an English examiner. Return strict JSON only.",
      user: evaluateConversationPrompt(request),
      schema: conversationEvaluationSchema,
      userId,
    });
    return {
      overall: result.data.overall,
      grammar: result.data.grammar,
      vocabulary: result.data.vocabulary,
      fluency: result.data.fluency,
      feedback: result.data.feedback,
      grammarErrors: result.data.grammarErrors,
      vocabularyNotes: result.data.vocabularyNotes,
      recommendations: result.data.recommendations,
      reviewTopics: result.data.reviewTopics,
      source: "ai",
    };
  } catch {
    return heuristicConversationEvaluation(request);
  }
}

export function getConversationEvalModel() {
  return getFunctionConfig("conversation_eval").model;
}
