import {
  getAIConfig,
  type AIProvider,
  type ContextualMeaningRequest,
  type ContextualMeaningResult,
  type ConversationEvaluationRequest,
  type RoleplayResponseRequest,
  type SpeakingEvaluationRequest,
  type SpeakingEvaluationResult,
  type TutorResponseRequest,
  type WritingEvaluationRequest,
  type WritingEvaluationResult,
} from "./AIProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";
import { StubAIProvider } from "./providers/StubAIProvider";
import {
  heuristicSpeakingEvaluation,
  heuristicWritingEvaluation,
} from "./heuristics";
import {
  heuristicConversationEvaluation,
  heuristicRoleplayResponse,
  heuristicTutorResponse,
} from "./heuristics/conversation";

export interface AICallOptions {
  userId?: string;
}

/**
 * Central AI facade. UI and learning engines must call only this service.
 */
export class AIService {
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    if (provider) {
      this.provider = provider;
      return;
    }
    const config = getAIConfig();
    this.provider =
      config.operational && config.provider === "openai"
        ? new OpenAIProvider()
        : new StubAIProvider();
  }

  getConfig() {
    return getAIConfig();
  }

  async getContextualMeaning(
    request: ContextualMeaningRequest,
    options?: AICallOptions
  ): Promise<ContextualMeaningResult> {
    if (this.provider instanceof OpenAIProvider) {
      return this.provider.getContextualMeaning(request, options?.userId);
    }
    return this.provider.getContextualMeaning(request);
  }

  async generateExplanation(topic: string, level: string) {
    if (this.provider.generateExplanation) {
      return this.provider.generateExplanation(topic, level);
    }
    return `Explanation for ${topic} (${level})`;
  }

  async transcribeAudio(audio: Buffer, mimeType: string) {
    if (this.provider.transcribeAudio) {
      return this.provider.transcribeAudio(audio, mimeType);
    }
    return "";
  }

  async evaluateSpeaking(
    request: SpeakingEvaluationRequest,
    options?: AICallOptions
  ): Promise<SpeakingEvaluationResult> {
    if (this.provider instanceof OpenAIProvider) {
      return this.provider.evaluateSpeaking(request, options?.userId);
    }
    if (this.provider.evaluateSpeaking) {
      return this.provider.evaluateSpeaking(request);
    }
    return heuristicSpeakingEvaluation(request);
  }

  async evaluateWriting(
    request: WritingEvaluationRequest,
    options?: AICallOptions
  ): Promise<WritingEvaluationResult> {
    if (this.provider instanceof OpenAIProvider) {
      return this.provider.evaluateWriting(request, options?.userId);
    }
    if (this.provider.evaluateWriting) {
      return this.provider.evaluateWriting(request);
    }
    return heuristicWritingEvaluation(request);
  }

  async generateTutorResponse(
    request: TutorResponseRequest,
    options?: AICallOptions
  ) {
    if (this.provider instanceof OpenAIProvider) {
      return this.provider.generateTutorResponse(request, options?.userId);
    }
    if (this.provider.generateTutorResponse) {
      return this.provider.generateTutorResponse(request);
    }
    return heuristicTutorResponse(request);
  }

  async generateRoleplayResponse(
    request: RoleplayResponseRequest,
    options?: AICallOptions
  ) {
    if (this.provider instanceof OpenAIProvider) {
      return this.provider.generateRoleplayResponse(request, options?.userId);
    }
    if (this.provider.generateRoleplayResponse) {
      return this.provider.generateRoleplayResponse(request);
    }
    return heuristicRoleplayResponse(request);
  }

  async evaluateConversation(
    request: ConversationEvaluationRequest,
    options?: AICallOptions
  ) {
    if (this.provider instanceof OpenAIProvider) {
      return this.provider.evaluateConversation(request, options?.userId);
    }
    if (this.provider.evaluateConversation) {
      return this.provider.evaluateConversation(request);
    }
    return heuristicConversationEvaluation(request);
  }
}

export const aiService = new AIService();
