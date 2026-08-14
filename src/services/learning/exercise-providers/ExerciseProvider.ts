import type {
  ExerciseGenerationContext,
  ExerciseProvider,
  ExerciseProviderId,
} from "@/types/practice";

export type { ExerciseProvider, ExerciseGenerationContext };

export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function stableShuffle<T>(items: T[], seed: string): T[] {
  const copy = [...items];
  let state = hashString(seed) || 1;
  for (let i = copy.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function makeCloze(sentence: string, target: string): string | null {
  if (!sentence || !target) return null;
  const re = new RegExp(`\\b${escapeRegExp(target)}\\b`, "i");
  if (!re.test(sentence)) return null;
  return sentence.replace(re, "_____");
}

const FALLBACK_IT = [
  "casa",
  "tempo",
  "amico",
  "lavoro",
  "città",
  "oggi",
  "sempre",
  "perché",
];

const FALLBACK_EN = [
  "however",
  "because",
  "instead",
  "already",
  "tomorrow",
  "usually",
];

export function pickDistractors(
  answer: string,
  pool: string[],
  seed: string,
  count = 3
): string[] {
  const lower = answer.trim().toLowerCase();
  const unique = [
    ...new Set(
      [...pool, ...FALLBACK_IT, ...FALLBACK_EN]
        .map((s) => s.trim())
        .filter((s) => s && s.toLowerCase() !== lower)
    ),
  ];
  return stableShuffle(unique, seed).slice(0, count);
}

/**
 * Factory: rule-based is the default. AI is reserved (returns []).
 */
export async function getExerciseProvider(
  preferred: ExerciseProviderId = "rule"
): Promise<ExerciseProvider> {
  if (preferred === "ai") {
    const { aiExerciseProvider } = await import("./AIExerciseProvider");
    return aiExerciseProvider;
  }
  const { ruleBasedExerciseProvider } = await import(
    "./RuleBasedExerciseProvider"
  );
  return ruleBasedExerciseProvider;
}
