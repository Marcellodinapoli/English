import OpenAI from "openai";
import type {
  AIProvider,
  ContextualMeaningRequest,
  ContextualMeaningResult,
  SpeakingEvaluationRequest,
  SpeakingEvaluationResult,
  WritingEvaluationRequest,
  WritingEvaluationResult,
} from "../AIProvider";
import { getAIConfig, getFunctionConfig } from "../config";
import { chatJsonValidated, getOpenAIClient } from "../aiCall";
import {
  contextualMeaningSchema,
  speakingEvaluationSchema,
  writingEvaluationSchema,
} from "../schemas";
import { contextualMeaningPrompt } from "../prompts/contextualMeaning";
import {
  evaluateSpeakingPrompt,
  evaluateWritingPrompt,
} from "../prompts/evaluateSpeaking";
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
  evaluateConversationOpenAI,
  generateRoleplayResponseOpenAI,
  generateTutorResponseOpenAI,
} from "./conversationAI";
import {
  contextualMeaningCacheKey,
  getCachedContextualMeaning,
  getInFlightContextualMeaning,
  setCachedContextualMeaning,
  setInFlightContextualMeaning,
} from "../cache/contextualMeaningCache";
import { logAICall, recordAICallLocal } from "../logging";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  private client: OpenAI;

  constructor() {
    this.client = getOpenAIClient()!;
  }

  async getContextualMeaning(
    request: ContextualMeaningRequest,
    userId?: string | null
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

    const cacheKey = contextualMeaningCacheKey(
      request.word,
      request.sentence,
      request.level
    );
    const cached = getCachedContextualMeaning(cacheKey);
    if (cached) {
      recordAICallLocal({
        function: "contextual_meaning",
        model: getFunctionConfig("contextual_meaning").model,
        provider: "cache",
        outcome: "success",
        latencyMs: 0,
        cached: true,
      });
      return { ...cached, source: "ai" };
    }

    const inflight = getInFlightContextualMeaning(cacheKey);
    if (inflight) return inflight;

    const promise = this.fetchContextualMeaning(request, cacheKey, userId);
    setInFlightContextualMeaning(cacheKey, promise);
    return promise;
  }

  private async fetchContextualMeaning(
    request: ContextualMeaningRequest,
    cacheKey: string,
    userId?: string | null
  ): Promise<ContextualMeaningResult> {
    try {
      const result = await chatJsonValidated({
        fn: "contextual_meaning",
        system:
          "You are an English teacher for Italian learners. Return strict JSON only.",
        user: contextualMeaningPrompt(request),
        schema: contextualMeaningSchema,
        userId,
      });

      const value: ContextualMeaningResult = {
        word: request.word,
        translation: result.data.translation,
        partOfSpeech: result.data.partOfSpeech,
        phonetic: result.data.phonetic,
        example: request.sentence,
        exampleTranslation: result.data.exampleTranslation,
        otherMeanings: result.data.otherMeanings || [],
        source: "ai",
      };
      setCachedContextualMeaning(cacheKey, value);
      return value;
    } catch {
      return {
        word: request.word,
        translation: request.otherMeanings?.[0]?.translation || request.word,
        partOfSpeech: request.pos || "other",
        example: request.sentence,
        otherMeanings: request.otherMeanings || [],
        source: "fallback",
      };
    }
  }

  async transcribeAudio(audio: Buffer, mimeType: string): Promise<string> {
    const config = getAIConfig();
    const fnCfg = getFunctionConfig("speaking_eval");
    const extension = mimeType.includes("mp4")
      ? "mp4"
      : mimeType.includes("ogg")
        ? "ogg"
        : "webm";

    const started = Date.now();
    try {
      const { toFile } = await import("openai/uploads");
      const file = await toFile(audio, `speech.${extension}`, {
        type: mimeType || `audio/${extension}`,
      });

      const result = await this.client.audio.transcriptions.create({
        file,
        model: config.sttModel,
        language: "en",
      });
      const latencyMs = Date.now() - started;
      recordAICallLocal({
        function: "speaking_eval",
        model: config.sttModel,
        provider: "openai",
        outcome: "success",
        latencyMs,
        meta: { stt: true },
      });
      await logAICall(null, {
        function: "speaking_eval",
        model: config.sttModel,
        provider: "openai",
        outcome: "success",
        latencyMs,
        meta: { stt: true },
      });
      return result.text || "";
    } catch {
      const latencyMs = Date.now() - started;
      recordAICallLocal({
        function: "speaking_eval",
        model: fnCfg.model,
        provider: "openai",
        outcome: "api_error",
        latencyMs,
        meta: { stt: true },
      });
      return "";
    }
  }

  async evaluateSpeaking(
    request: SpeakingEvaluationRequest,
    userId?: string | null
  ): Promise<SpeakingEvaluationResult> {
    try {
      const result = await chatJsonValidated({
        fn: "speaking_eval",
        system:
          "You are a supportive English speaking examiner. Do NOT score pronunciation. Return strict JSON only.",
        user: evaluateSpeakingPrompt(request),
        schema: speakingEvaluationSchema,
        userId,
      });

      return {
        transcript: request.transcript,
        overall: result.data.overall,
        accuracy: result.data.accuracy,
        fluency: result.data.fluency,
        vocabulary: result.data.vocabulary,
        grammar: result.data.grammar,
        transcriptQuality: result.data.transcriptQuality,
        feedback: result.data.feedback,
        suggestions: result.data.suggestions,
        corrections: result.data.corrections,
        source: "ai",
        pronunciationAssessed: false,
      };
    } catch {
      return heuristicSpeakingEvaluation(request);
    }
  }

  async evaluateWriting(
    request: WritingEvaluationRequest,
    userId?: string | null
  ): Promise<WritingEvaluationResult> {
    try {
      const result = await chatJsonValidated({
        fn: "writing_eval",
        system:
          "You are a supportive English writing examiner. Return strict JSON only.",
        user: evaluateWritingPrompt(request),
        schema: writingEvaluationSchema,
        userId,
      });

      return {
        overall: result.data.overall,
        grammar: result.data.grammar,
        vocabulary: result.data.vocabulary,
        accuracy: result.data.accuracy,
        fluency: result.data.fluency,
        feedback: result.data.feedback,
        suggestions: result.data.suggestions,
        correctedText: result.data.correctedText,
        mistakes: result.data.mistakes.map((m) => ({
          original: m.original,
          correction: m.correction,
          type: m.type,
          topic: m.topic,
          skill: m.skill,
        })),
        source: "ai",
      };
    } catch {
      return heuristicWritingEvaluation(request);
    }
  }

  async generateTutorResponse(
    request: TutorResponseRequest,
    userId?: string | null
  ) {
    return generateTutorResponseOpenAI(this.client, request, userId);
  }

  async generateRoleplayResponse(
    request: RoleplayResponseRequest,
    userId?: string | null
  ) {
    return generateRoleplayResponseOpenAI(this.client, request, userId);
  }

  async evaluateConversation(
    request: ConversationEvaluationRequest,
    userId?: string | null
  ) {
    return evaluateConversationOpenAI(this.client, request, userId);
  }
}
