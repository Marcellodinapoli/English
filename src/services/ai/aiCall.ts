import OpenAI from "openai";
import type { ZodSchema } from "zod";
import { getAIConfig, getFunctionConfig, isAIOperational, type AIFunctionName } from "./config";
import {
  logAICall,
  recordAICallLocal,
  type AICallOutcome,
} from "./logging";

export class AICallError extends Error {
  constructor(
    message: string,
    readonly code: AICallOutcome,
    readonly status?: number
  ) {
    super(message);
    this.name = "AICallError";
  }
}

let sharedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  if (!isAIOperational()) return null;
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  if (!sharedClient) {
    sharedClient = new OpenAI({ apiKey: key });
  }
  return sharedClient;
}

export function resetOpenAIClientForTests() {
  sharedClient = null;
}

function isRateLimitError(err: unknown) {
  if (err && typeof err === "object" && "status" in err) {
    return (err as { status?: number }).status === 429;
  }
  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ChatJsonOptions<T> {
  fn: AIFunctionName;
  system: string;
  user: string;
  schema: ZodSchema<T>;
  userId?: string | null;
}

export interface ChatJsonResult<T> {
  data: T;
  model: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  retried: boolean;
}

/**
 * Server-side OpenAI chat completion with timeout, single retry on 429, Zod validation.
 * Throws AICallError on failure — callers should fallback.
 */
let testHook: ((options: ChatJsonOptions<unknown>) => Promise<ChatJsonResult<unknown>>) | null =
  null;

export function setChatJsonValidatedTestHook(
  hook: typeof testHook
) {
  testHook = hook;
}

export function clearChatJsonValidatedTestHook() {
  testHook = null;
}

export async function chatJsonValidated<T>(
  options: ChatJsonOptions<T>
): Promise<ChatJsonResult<T>> {
  const cfg = getFunctionConfig(options.fn);
  const aiCfg = getAIConfig();
  const started = Date.now();
  let retried = false;

  async function logOutcome(outcome: AICallOutcome, extra?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  }) {
    const logPayload = {
      function: options.fn,
      model: cfg.model,
      provider: "openai" as const,
      outcome,
      latencyMs: Date.now() - started,
      retried,
      ...extra,
    };
    recordAICallLocal(logPayload);
    await logAICall(options.userId ?? null, logPayload);
  }

  async function attempt(): Promise<ChatJsonResult<T>> {
    if (testHook) {
      const result = (await testHook(options)) as ChatJsonResult<T>;
      await logOutcome("success", {
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
      });
      return { ...result, retried };
    }

    const client = getOpenAIClient();
    if (!client) {
      throw new AICallError("No OpenAI API key", "api_error");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

    try {
      const completion = await client.chat.completions.create(
        {
          model: cfg.model,
          temperature: cfg.temperature,
          max_tokens: cfg.maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: options.system },
            { role: "user", content: options.user },
          ],
        },
        { signal: controller.signal }
      );

      const raw = completion.choices[0]?.message?.content || "{}";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new AICallError("Invalid JSON from model", "validation_failed");
      }

      const validated = options.schema.safeParse(parsed);
      if (!validated.success) {
        throw new AICallError("Schema validation failed", "validation_failed");
      }

      const usage = completion.usage;
      await logOutcome("success", {
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
      });

      return {
        data: validated.data,
        model: cfg.model,
        latencyMs: Date.now() - started,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
        retried,
      };
    } catch (err) {
      if (err instanceof AICallError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new AICallError("OpenAI request timeout", "timeout");
      }
      if (isRateLimitError(err)) {
        throw new AICallError("Rate limited", "rate_limited", 429);
      }
      throw new AICallError(
        err instanceof Error ? err.message : "OpenAI API error",
        "api_error"
      );
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    return await attempt();
  } catch (first) {
    if (
      first instanceof AICallError &&
      first.code === "rate_limited" &&
      !retried
    ) {
      retried = true;
      await sleep(aiCfg.retryBackoffMs);
      try {
        return await attempt();
      } catch (second) {
        await logOutcome(
          second instanceof AICallError ? second.code : "api_error"
        );
        throw second;
      }
    }

    await logOutcome(
      first instanceof AICallError ? first.code : "api_error"
    );
    throw first;
  }
}
