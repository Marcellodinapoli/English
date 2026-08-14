import { prisma } from "@/lib/prisma";
import type { AIFunctionName } from "./config";

export type AICallOutcome =
  | "success"
  | "validation_failed"
  | "timeout"
  | "rate_limited"
  | "api_error"
  | "fallback";

export interface AICallLogPayload {
  function: AIFunctionName;
  model: string;
  provider: "openai" | "stub" | "cache" | "heuristic";
  outcome: AICallOutcome;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cached?: boolean;
  retried?: boolean;
  /** Never log user text or API keys */
  meta?: Record<string, string | number | boolean>;
}

/**
 * Internal AI usage logging — no sensitive content, no API keys.
 */
export async function logAICall(userId: string | null, payload: AICallLogPayload) {
  try {
    if (!userId) return;
    await prisma.analyticsEvent.create({
      data: {
        userId,
        event: "ai_call",
        metadata: JSON.stringify({
          fn: payload.function,
          model: payload.model,
          provider: payload.provider,
          outcome: payload.outcome,
          latencyMs: payload.latencyMs,
          promptTokens: payload.promptTokens,
          completionTokens: payload.completionTokens,
          totalTokens: payload.totalTokens,
          cached: payload.cached ?? false,
          retried: payload.retried ?? false,
          ...payload.meta,
        }),
      },
    });
  } catch {
    // logging must not break user flows
  }
}

/** In-memory ring for tests / dev inspection (no PII). */
const recentLogs: AICallLogPayload[] = [];
const MAX_RECENT = 50;

export function recordAICallLocal(payload: AICallLogPayload) {
  recentLogs.unshift(payload);
  if (recentLogs.length > MAX_RECENT) recentLogs.pop();
}

export function getRecentAICallLogs() {
  return [...recentLogs];
}

export function clearRecentAICallLogs() {
  recentLogs.length = 0;
}
