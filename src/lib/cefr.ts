import type { CEFRLevel } from "@/types/learning";

export const CEFR_ORDER: CEFRLevel[] = [
  "ZERO",
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
];

export function normalizeLevel(level: string): CEFRLevel {
  const upper = level.toUpperCase();
  if (upper === "ZERO") return "ZERO";
  const found = CEFR_ORDER.find((l) => l === upper);
  return found || "ZERO";
}

export function levelIndex(level: string): number {
  return CEFR_ORDER.indexOf(normalizeLevel(level));
}

export function canAccessLevel(userLevel: string, targetLevel: string): boolean {
  return levelIndex(targetLevel) <= levelIndex(userLevel);
}

export function nextLevel(level: string): CEFRLevel | null {
  const idx = levelIndex(level);
  if (idx >= CEFR_ORDER.length - 1) return null;
  return CEFR_ORDER[idx + 1];
}

export function levelBaseSubLevel(level: string): number {
  if (level === "ZERO") return 0.1;
  const idx = levelIndex(level);
  return idx <= 0 ? 0.1 : idx;
}
