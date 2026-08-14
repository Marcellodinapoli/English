"use client";

import { CEFR_ORDER } from "@/lib/cefr";

function levelKey(raw: string): string {
  const upper = raw.toUpperCase();
  if (upper.startsWith("ZERO")) return "ZERO";
  for (const level of CEFR_ORDER) {
    if (level !== "ZERO" && upper.startsWith(level)) return level;
  }
  const match = upper.match(/^[A-Z0-9]+/);
  return match?.[0] || upper;
}

export function groupByCefrLevel<T extends { level: string }>(
  items: T[]
): Array<{ level: string; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = levelKey(item.level);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }

  const ordered = CEFR_ORDER.filter((l) => map.has(l)).map((level) => ({
    level,
    items: map.get(level)!,
  }));

  const extras = [...map.keys()]
    .filter((k) => !CEFR_ORDER.includes(k as (typeof CEFR_ORDER)[number]))
    .sort()
    .map((level) => ({ level, items: map.get(level)! }));

  return [...ordered, ...extras];
}
