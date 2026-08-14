"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getAudioService } from "@/services/audio/AudioService";
import type { ContentToken } from "@/types/content";
import type {
  ExpressionDef,
  ExpressionPopupData,
  ReadingPopupData,
  WordPopupDataV2,
} from "@/types/expression";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Volume2, BookmarkPlus, Check } from "lucide-react";
import { useMemo, useState } from "react";
import {
  findExpressionSpans,
  spanAtIndex,
  type ExpressionSpan,
} from "@/services/content/ExpressionMatcher";

function tokenToWordPopup(
  token: ContentToken,
  sentence: string,
  sentenceTranslation: string | undefined,
  level: string | undefined,
  sourceContentId: string | undefined
): WordPopupDataV2 {
  const idx = token.contextualMeaningIndex ?? 0;
  const primary = token.meanings[idx] || token.meanings[0];
  const others = token.meanings.filter((_, i) => i !== idx);

  return {
    kind: "word",
    word: token.word,
    lemma: token.lemma,
    translation: primary?.translation || token.word,
    partOfSpeech: primary?.partOfSpeech || token.pos,
    phonetic: token.phonetic,
    example: sentence,
    exampleTranslation: sentenceTranslation,
    otherMeanings: others.map((m) => ({
      translation: m.translation,
      partOfSpeech: m.partOfSpeech,
    })),
    level,
    sourceContentId,
  };
}

function expressionToPopup(
  def: ExpressionDef,
  sentence: string,
  sentenceTranslation: string | undefined,
  level: string | undefined,
  sourceContentId: string | undefined
): ExpressionPopupData {
  return {
    kind: "expression",
    expressionId: def.id,
    expression: def.expression,
    translation: def.translation,
    pronunciation: def.pronunciation,
    phonetic: def.phonetic,
    example: def.example || sentence,
    exampleTranslation: def.exampleTranslation || sentenceTranslation,
    level: def.level || level,
    category: def.category,
    sourceContentId,
  };
}

function ReadingPopupContent({
  data,
  onSaved,
}: {
  data: ReadingPopupData;
  onSaved?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(data.saved));
  const [error, setError] = useState<string | null>(null);
  const [masteryScore, setMasteryScore] = useState(data.masteryScore ?? 0);
  const [inQueue, setInQueue] = useState(Boolean(data.inReviewQueue));
  const audio = getAudioService();

  const isExpression = data.kind === "expression";
  const speakText = isExpression ? data.expression : data.word;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (isExpression) {
        const res = await fetch("/api/expressions/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expression: data.expression,
            expressionId: data.expressionId,
            translation: data.translation,
            pronunciation: data.pronunciation,
            phonetic: data.phonetic,
            example: data.example,
            exampleTranslation: data.exampleTranslation,
            level: data.level || "A1",
            category: data.category,
            context: data.example,
            sourceContentId: data.sourceContentId,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Could not save expression");
        }
        const body = await res.json();
        setMasteryScore(body.item?.masteryScore ?? 0);
        setInQueue(true);
      } else {
        const res = await fetch("/api/vocabulary/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word: data.word,
            lemma: data.lemma,
            translation: data.translation,
            partOfSpeech: data.partOfSpeech,
            phonetic: data.phonetic,
            pronunciation: data.phonetic || "",
            exampleSentence: data.example,
            exampleTranslation: data.exampleTranslation || "",
            context: data.example,
            level: data.level || "A1",
            sourceContentId: data.sourceContentId,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Could not save word");
        }
        setInQueue(true);
      }
      setSaved(true);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="brand-mark text-3xl text-ink">{speakText}</p>
            {!isExpression && data.lemma !== data.word.toLowerCase() ? (
              <p className="mt-1 text-sm text-muted">lemma: {data.lemma}</p>
            ) : null}
            {isExpression && data.pronunciation ? (
              <p className="mt-1 text-sm text-muted">{data.pronunciation}</p>
            ) : null}
          </div>
          <Button
            variant="soft"
            size="icon"
            aria-label="Listen"
            onClick={() => audio.speak(speakText)}
          >
            <Volume2 className="h-4 w-4" />
          </Button>
        </div>
        {data.phonetic ? (
          <p className="mt-2 font-[family-name:var(--font-newsreader)] text-lg text-muted">
            {data.phonetic}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl bg-sand/80 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {isExpression ? (
            <Badge tone="teal">{data.category || "expression"}</Badge>
          ) : (
            <Badge tone="teal">{data.partOfSpeech}</Badge>
          )}
          {data.level ? <Badge>{data.level}</Badge> : null}
          {inQueue ? <Badge tone="success">In review</Badge> : null}
          {saved || masteryScore > 0 ? (
            <Badge>Mastery {Math.round(masteryScore)}%</Badge>
          ) : null}
        </div>
        <p className="mt-3 text-xl font-semibold text-ink">{data.translation}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          {isExpression ? "Example" : "Context"}
        </p>
        <p className="mt-2 reading-text text-[1.15rem] text-ink">{data.example}</p>
        {data.exampleTranslation ? (
          <p className="mt-1 text-sm text-muted">{data.exampleTranslation}</p>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 px-0"
          onClick={() => audio.speak(data.example)}
        >
          <Volume2 className="h-4 w-4" /> Listen example
        </Button>
      </div>

      {!isExpression && data.otherMeanings.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Other meanings
          </p>
          <ul className="mt-2 space-y-1.5">
            {data.otherMeanings.map((m, i) => (
              <li key={`${m.translation}-${i}`} className="text-sm text-ink-soft">
                <span className="font-medium">{m.partOfSpeech}</span> — {m.translation}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Button
        className="w-full"
        size="lg"
        onClick={save}
        disabled={saving || saved}
      >
        {saved ? (
          <>
            <Check className="h-4 w-4" />{" "}
            {isExpression ? "Saved expression" : "Saved to vocabulary"}
          </>
        ) : (
          <>
            <BookmarkPlus className="h-4 w-4" />{" "}
            {isExpression ? "Save expression" : "Save Word"}
          </>
        )}
      </Button>
    </div>
  );
}

/** @deprecated keep export name for lesson pages */
export type WordPopupData = WordPopupDataV2;
export { ReadingPopupContent as WordPopupContent };

export function InteractiveText({
  sentences,
  level,
  sourceContentId,
  expressionCatalog = [],
}: {
  sentences: Array<{
    id: string;
    text: string;
    translation?: string;
    tokens: ContentToken[];
  }>;
  level?: string;
  sourceContentId?: string;
  expressionCatalog?: ExpressionDef[];
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [selected, setSelected] = useState<ReadingPopupData | null>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(
    null
  );

  const spansBySentence = useMemo(() => {
    return sentences.map((sentence) =>
      findExpressionSpans(sentence.tokens, expressionCatalog)
    );
  }, [sentences, expressionCatalog]);

  async function enrichStatus(data: ReadingPopupData): Promise<ReadingPopupData> {
    try {
      if (data.kind === "expression") {
        const res = await fetch(
          `/api/expressions/save?expression=${encodeURIComponent(data.expression)}`
        );
        if (res.ok) {
          const body = await res.json();
          return {
            ...data,
            saved: body.saved,
            masteryScore: body.masteryScore,
            inReviewQueue: body.inReviewQueue,
            status: body.status || undefined,
          };
        }
      }
    } catch {
      // ignore status enrichment failures
    }
    return data;
  }

  async function onTokenClick(
    token: ContentToken,
    tokenIndex: number,
    sentence: { text: string; translation?: string },
    spans: ExpressionSpan[],
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    if (token.isPunctuation) return;

    const span = spanAtIndex(spans, tokenIndex);
    let data: ReadingPopupData;

    if (span) {
      data = expressionToPopup(
        span.expression,
        sentence.text,
        sentence.translation,
        level,
        sourceContentId
      );
      await fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "expression_clicked",
          metadata: { expression: span.expression.expression, sentence: sentence.text },
        }),
      }).catch(() => undefined);
    } else {
      await fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "word_clicked",
          metadata: { word: token.word, sentence: sentence.text },
        }),
      }).catch(() => undefined);

      data = tokenToWordPopup(
        token,
        sentence.text,
        sentence.translation,
        level,
        sourceContentId
      );

      if (!token.meanings.length) {
        const res = await fetch("/api/ai/contextual-meaning", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word: token.word,
            sentence: sentence.text,
            lemma: token.lemma,
            pos: token.pos,
            level,
          }),
        });
        if (res.ok) {
          const body = await res.json();
          data = {
            ...data,
            translation: body.translation,
            partOfSpeech: body.partOfSpeech,
            phonetic: body.phonetic || data.phonetic,
            exampleTranslation: body.exampleTranslation || sentence.translation,
            otherMeanings: body.otherMeanings || [],
          };
        }
      }
    }

    data = await enrichStatus(data);

    if (isDesktop) {
      const rect = event.currentTarget.getBoundingClientRect();
      setAnchor({
        top: rect.bottom + window.scrollY + 8,
        left: Math.min(rect.left + window.scrollX, window.innerWidth - 360),
      });
    } else {
      setAnchor(null);
    }
    setSelected(data);
  }

  const activeExpression =
    selected?.kind === "expression" ? selected.expression.toLowerCase() : null;
  const activeWord =
    selected?.kind === "word" ? selected.word.toLowerCase() : null;

  return (
    <>
      <div className="space-y-5">
        {sentences.map((sentence, sIdx) => {
          const spans = spansBySentence[sIdx] || [];
          return (
            <p key={sentence.id} className="reading-text text-ink">
              {sentence.tokens.map((token, index) => {
                const needsSpaceBefore =
                  index > 0 &&
                  !token.isPunctuation &&
                  !sentence.tokens[index - 1]?.isPunctuation;

                if (token.isPunctuation) {
                  return (
                    <span key={`${sentence.id}-${index}`}>{token.word}</span>
                  );
                }

                const span = spanAtIndex(spans, index);
                const isExprActive =
                  Boolean(span) &&
                  span!.expression.expression.toLowerCase() === activeExpression;
                const isWordActive =
                  !span && token.word.toLowerCase() === activeWord;

                return (
                  <span key={`${sentence.id}-${index}`}>
                    {needsSpaceBefore ? " " : null}
                    <button
                      type="button"
                      className="word-token"
                      data-active={isExprActive || isWordActive}
                      data-expression={span ? "true" : undefined}
                      title={
                        span
                          ? `Expression: ${span.expression.expression}`
                          : undefined
                      }
                      onClick={(e) =>
                        onTokenClick(token, index, sentence, spans, e)
                      }
                    >
                      {token.word}
                    </button>
                  </span>
                );
              })}
            </p>
          );
        })}
      </div>

      {selected && isDesktop && anchor ? (
        <div
          className="absolute z-40 w-[340px] rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-lift)]"
          style={{ top: anchor.top, left: anchor.left }}
        >
          <ReadingPopupContent data={selected} onSaved={() => undefined} />
          <Button
            variant="ghost"
            className="mt-3 w-full"
            onClick={() => setSelected(null)}
          >
            Close
          </Button>
        </div>
      ) : null}

      {!isDesktop ? (
        <Modal open={Boolean(selected)} onClose={() => setSelected(null)}>
          {selected ? <ReadingPopupContent data={selected} /> : null}
        </Modal>
      ) : null}
    </>
  );
}
