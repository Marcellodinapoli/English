import type {
  AIProvider,
  ContextualMeaningRequest,
  ContextualMeaningResult,
  SpeakingEvaluationRequest,
  SpeakingEvaluationResult,
  WritingEvaluationRequest,
  WritingEvaluationResult,
} from "../AIProvider";
import {
  heuristicSpeakingEvaluation,
  heuristicWritingEvaluation,
} from "../heuristics";
import type {
  ConversationEvaluationRequest,
  RoleplayResponseRequest,
  TutorResponseRequest,
} from "../AIProvider";
import {
  heuristicConversationEvaluation,
  heuristicRoleplayResponse,
  heuristicTutorResponse,
} from "../heuristics/conversation";

export class StubAIProvider implements AIProvider {
  readonly name = "stub" as const;

  async getContextualMeaning(
    request: ContextualMeaningRequest
  ): Promise<ContextualMeaningResult> {
    if (request.annotatedTranslation) {
      return {
        word: request.word,
        translation: request.annotatedTranslation,
        partOfSpeech: request.pos || "other",
        example: request.sentence,
        otherMeanings: request.otherMeanings || [],
        source: "annotation",
      };
    }

    return {
      word: request.word,
      translation: `(${request.word}) — significato contestuale disponibile con AI`,
      partOfSpeech: request.pos || "other",
      example: request.sentence,
      otherMeanings: request.otherMeanings || [],
      source: "fallback",
    };
  }

  async generateExplanation(topic: string, level: string) {
    return `Explanation for "${topic}" at level ${level} will use the configured AI provider when an API key is set.`;
  }

  async evaluateSpeaking(
    request: SpeakingEvaluationRequest
  ): Promise<SpeakingEvaluationResult> {
    return heuristicSpeakingEvaluation(request);
  }

  async evaluateWriting(
    request: WritingEvaluationRequest
  ): Promise<WritingEvaluationResult> {
    return heuristicWritingEvaluation(request);
  }

  async generateTutorResponse(request: TutorResponseRequest) {
    return heuristicTutorResponse(request);
  }

  async generateRoleplayResponse(request: RoleplayResponseRequest) {
    return heuristicRoleplayResponse(request);
  }

  async evaluateConversation(request: ConversationEvaluationRequest) {
    return heuristicConversationEvaluation(request);
  }
}
