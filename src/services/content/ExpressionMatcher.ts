import type { ContentToken } from "@/types/content";
import type { ExpressionDef } from "@/types/expression";

export interface ExpressionSpan {
  start: number;
  end: number; // exclusive token index
  expression: ExpressionDef;
}

function normalizeWord(word: string) {
  return word.trim().toLowerCase().replace(/[.?!,;:'"]+/g, "");
}

function expressionForms(def: ExpressionDef): string[][] {
  const forms = [def.expression, ...(def.aliases || [])];
  return forms.map((f) =>
    f
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((w) => normalizeWord(w))
      .filter(Boolean)
  );
}

/**
 * Find non-overlapping multi-word expression spans in a token list.
 * Longest match wins when expressions overlap.
 */
export function findExpressionSpans(
  tokens: ContentToken[],
  catalog: ExpressionDef[]
): ExpressionSpan[] {
  const words = tokens.map((t) =>
    t.isPunctuation ? "" : normalizeWord(t.word)
  );

  const candidates: ExpressionSpan[] = [];

  for (const def of catalog) {
    for (const parts of expressionForms(def)) {
      if (parts.length < 2) continue;
      for (let i = 0; i <= words.length - parts.length; i++) {
        let ok = true;
        for (let j = 0; j < parts.length; j++) {
          if (words[i + j] !== parts[j]) {
            ok = false;
            break;
          }
        }
        if (ok) {
          candidates.push({ start: i, end: i + parts.length, expression: def });
        }
      }
    }
  }

  candidates.sort(
    (a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start
  );

  const taken = new Array(tokens.length).fill(false);
  const spans: ExpressionSpan[] = [];
  for (const span of candidates) {
    let conflict = false;
    for (let i = span.start; i < span.end; i++) {
      if (taken[i]) {
        conflict = true;
        break;
      }
    }
    if (conflict) continue;
    for (let i = span.start; i < span.end; i++) taken[i] = true;
    spans.push(span);
  }

  return spans.sort((a, b) => a.start - b.start);
}

export function spanAtIndex(
  spans: ExpressionSpan[],
  tokenIndex: number
): ExpressionSpan | null {
  return (
    spans.find((s) => tokenIndex >= s.start && tokenIndex < s.end) || null
  );
}

export function normalizeExpressionKey(expression: string) {
  return expression.trim().toLowerCase().replace(/\s+/g, " ");
}
