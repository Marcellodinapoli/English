import fs from "fs";
import path from "path";
import type { ExpressionDef } from "@/types/expression";
import {
  findExpressionSpans,
  normalizeExpressionKey,
  type ExpressionSpan,
} from "@/services/content/ExpressionMatcher";
import type { ContentToken } from "@/types/content";

const CATALOG_PATH = path.join(
  process.cwd(),
  "content",
  "expressions",
  "catalog.json"
);

let catalogCache: ExpressionDef[] | null = null;

export class ExpressionService {
  listCatalog(): ExpressionDef[] {
    if (catalogCache) return catalogCache;
    if (!fs.existsSync(/* turbopackIgnore: true */ CATALOG_PATH)) {
      catalogCache = [];
      return catalogCache;
    }
    catalogCache = JSON.parse(
      fs.readFileSync(/* turbopackIgnore: true */ CATALOG_PATH, "utf-8")
    ) as ExpressionDef[];
    return catalogCache;
  }

  invalidateCache() {
    catalogCache = null;
  }

  getById(id: string): ExpressionDef | null {
    return this.listCatalog().find((e) => e.id === id) ?? null;
  }

  findBySurface(expression: string): ExpressionDef | null {
    const key = normalizeExpressionKey(expression);
    return (
      this.listCatalog().find((e) => {
        if (normalizeExpressionKey(e.expression) === key) return true;
        return (e.aliases || []).some(
          (a) => normalizeExpressionKey(a) === key
        );
      }) ?? null
    );
  }

  /** Multi-word items from vocabularyFocus that exist in catalog or can be ad-hoc */
  resolveForPassage(
    vocabularyFocus: string[] | undefined,
    tokensBySentence: ContentToken[][]
  ): { catalog: ExpressionDef[]; spansBySentence: ExpressionSpan[][] } {
    const catalog = this.listCatalog();
    const spansBySentence = tokensBySentence.map((tokens) =>
      findExpressionSpans(tokens, catalog)
    );

    // Ensure multi-word vocab focus without catalog entry still matchable via ad-hoc defs
    const extra: ExpressionDef[] = [];
    for (const focus of vocabularyFocus || []) {
      const parts = focus.trim().split(/\s+/);
      if (parts.length < 2) continue;
      if (this.findBySurface(focus)) continue;
      extra.push({
        id: `ad-hoc-${normalizeExpressionKey(focus).replace(/\s+/g, "-")}`,
        expression: focus,
        translation: focus,
        example: focus,
        level: "A1",
        category: "vocabulary_focus",
        metadata: { adHoc: true },
      });
    }

    if (extra.length) {
      const merged = [...catalog, ...extra];
      return {
        catalog: merged,
        spansBySentence: tokensBySentence.map((tokens) =>
          findExpressionSpans(tokens, merged)
        ),
      };
    }

    return { catalog, spansBySentence };
  }
}

export const expressionService = new ExpressionService();
