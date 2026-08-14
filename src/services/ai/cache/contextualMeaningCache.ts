import type { ContextualMeaningResult } from "../AIProvider";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  value: ContextualMeaningResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<ContextualMeaningResult>>();

export function contextualMeaningCacheKey(
  word: string,
  sentence: string,
  level?: string
) {
  return `${word.toLowerCase().trim()}|${sentence.trim()}|${(level || "A1").toUpperCase()}`;
}

export function getCachedContextualMeaning(
  key: string
): ContextualMeaningResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return { ...entry.value, source: entry.value.source === "ai" ? "ai" : entry.value.source };
}

export function setCachedContextualMeaning(
  key: string,
  value: ContextualMeaningResult,
  ttlMs = DEFAULT_TTL_MS
) {
  cache.set(key, {
    value: { ...value, source: value.source === "annotation" ? "annotation" : "ai" },
    expiresAt: Date.now() + ttlMs,
  });
}

export function getInFlightContextualMeaning(key: string) {
  return inFlight.get(key);
}

export function setInFlightContextualMeaning(
  key: string,
  promise: Promise<ContextualMeaningResult>
) {
  inFlight.set(key, promise);
  promise.finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  });
}

/** Test helper */
export function clearContextualMeaningCache() {
  cache.clear();
  inFlight.clear();
}

export function contextualMeaningCacheSize() {
  return cache.size;
}
