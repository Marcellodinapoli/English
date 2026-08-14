import type { AIProviderName } from "./AIProvider";

/** Per-function AI settings — override via env: AI_MODEL_<FUNCTION>, AI_MAX_TOKENS_<FUNCTION>, etc. */
export type AIFunctionName =
  | "contextual_meaning"
  | "ai_exercise"
  | "writing_eval"
  | "speaking_eval"
  | "tutor"
  | "roleplay"
  | "conversation_eval";

export interface AIFunctionConfig {
  model: string;
  maxTokens: number;
  timeoutMs: number;
  temperature: number;
}

const FUNCTION_ENV_KEYS: Record<
  AIFunctionName,
  { model: string; maxTokens: string; timeout: string; temperature: string }
> = {
  contextual_meaning: {
    model: "AI_MODEL_CONTEXTUAL_MEANING",
    maxTokens: "AI_MAX_TOKENS_CONTEXTUAL_MEANING",
    timeout: "AI_TIMEOUT_CONTEXTUAL_MEANING",
    temperature: "AI_TEMP_CONTEXTUAL_MEANING",
  },
  ai_exercise: {
    model: "AI_MODEL_AI_EXERCISE",
    maxTokens: "AI_MAX_TOKENS_AI_EXERCISE",
    timeout: "AI_TIMEOUT_AI_EXERCISE",
    temperature: "AI_TEMP_AI_EXERCISE",
  },
  writing_eval: {
    model: "AI_MODEL_WRITING_EVAL",
    maxTokens: "AI_MAX_TOKENS_WRITING_EVAL",
    timeout: "AI_TIMEOUT_WRITING_EVAL",
    temperature: "AI_TEMP_WRITING_EVAL",
  },
  speaking_eval: {
    model: "AI_MODEL_SPEAKING_EVAL",
    maxTokens: "AI_MAX_TOKENS_SPEAKING_EVAL",
    timeout: "AI_TIMEOUT_SPEAKING_EVAL",
    temperature: "AI_TEMP_SPEAKING_EVAL",
  },
  tutor: {
    model: "AI_MODEL_TUTOR",
    maxTokens: "AI_MAX_TOKENS_TUTOR",
    timeout: "AI_TIMEOUT_TUTOR",
    temperature: "AI_TEMP_TUTOR",
  },
  roleplay: {
    model: "AI_MODEL_ROLEPLAY",
    maxTokens: "AI_MAX_TOKENS_ROLEPLAY",
    timeout: "AI_TIMEOUT_ROLEPLAY",
    temperature: "AI_TEMP_ROLEPLAY",
  },
  conversation_eval: {
    model: "AI_MODEL_CONVERSATION_EVAL",
    maxTokens: "AI_MAX_TOKENS_CONVERSATION_EVAL",
    timeout: "AI_TIMEOUT_CONVERSATION_EVAL",
    temperature: "AI_TEMP_CONVERSATION_EVAL",
  },
};

const DEFAULTS: Record<AIFunctionName, AIFunctionConfig> = {
  contextual_meaning: {
    model: "gpt-4o-mini",
    maxTokens: 400,
    timeoutMs: 12_000,
    temperature: 0.2,
  },
  ai_exercise: {
    model: "gpt-4o-mini",
    maxTokens: 2500,
    timeoutMs: 20_000,
    temperature: 0.35,
  },
  writing_eval: {
    model: "gpt-4o-mini",
    maxTokens: 1200,
    timeoutMs: 18_000,
    temperature: 0.3,
  },
  speaking_eval: {
    model: "gpt-4o-mini",
    maxTokens: 900,
    timeoutMs: 15_000,
    temperature: 0.3,
  },
  tutor: {
    model: "gpt-4o-mini",
    maxTokens: 600,
    timeoutMs: 15_000,
    temperature: 0.5,
  },
  roleplay: {
    model: "gpt-4o-mini",
    maxTokens: 500,
    timeoutMs: 15_000,
    temperature: 0.55,
  },
  conversation_eval: {
    model: "gpt-4o-mini",
    maxTokens: 1000,
    timeoutMs: 18_000,
    temperature: 0.3,
  },
};

export interface AIConfig {
  provider: AIProviderName;
  chatModel: string;
  ttsModel: string;
  sttModel: string;
  /** True when OPENAI_API_KEY is present (may still be dormant). */
  hasApiKey: boolean;
  /**
   * True only when AI is explicitly turned on AND a key is present.
   * Default (AI_ENABLED unset/false): stub/heuristics — full Alinea didactic path.
   */
  operational: boolean;
  retryBackoffMs: number;
}

export function getDefaultChatModel() {
  return process.env.AI_CHAT_MODEL || "gpt-4o-mini";
}

/**
 * OpenAI stays prepared in the codebase but inactive until AI_ENABLED=true
 * and OPENAI_API_KEY are both set. Does not change didactic engines.
 */
export function isAIOperational(): boolean {
  const enabled =
    process.env.AI_ENABLED === "true" || process.env.AI_ENABLED === "1";
  return enabled && Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getFunctionConfig(fn: AIFunctionName): AIFunctionConfig {
  const keys = FUNCTION_ENV_KEYS[fn];
  const defaults = DEFAULTS[fn];
  const globalModel = getDefaultChatModel();

  return {
    model:
      process.env[keys.model]?.trim() ||
      globalModel ||
      defaults.model,
    maxTokens: Number(process.env[keys.maxTokens]) || defaults.maxTokens,
    timeoutMs: Number(process.env[keys.timeout]) || defaults.timeoutMs,
    temperature:
      Number(process.env[keys.temperature]) || defaults.temperature,
  };
}

export function getAIConfig(): AIConfig {
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const operational = isAIOperational();
  return {
    provider: operational
      ? ((process.env.AI_PROVIDER as AIProviderName) || "openai")
      : "stub",
    chatModel: getDefaultChatModel(),
    ttsModel: process.env.AI_TTS_MODEL || "tts-1",
    sttModel: process.env.AI_STT_MODEL || "whisper-1",
    hasApiKey,
    operational,
    retryBackoffMs: Number(process.env.AI_RETRY_BACKOFF_MS) || 800,
  };
}
