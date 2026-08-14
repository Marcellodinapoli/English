"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAudioService } from "@/services/audio/AudioService";
import { Volume2 } from "lucide-react";
import Link from "next/link";

type VocabItem = {
  id: string;
  word: string;
  lemma: string;
  translation: string;
  partOfSpeech: string;
  phonetic?: string | null;
  exampleSentence: string;
  exampleTranslation: string;
  level: string;
  status: string;
  masteryScore: number;
};

type ExpressionItem = {
  id: string;
  expression: string;
  translation: string;
  pronunciation?: string | null;
  phonetic?: string | null;
  example?: string | null;
  exampleTranslation?: string | null;
  level: string;
  status: string;
  masteryScore: number;
  category?: string | null;
};

export default function VocabularyPage() {
  const audio = getAudioService();
  const vocabQuery = useQuery({
    queryKey: ["vocabulary"],
    queryFn: async () => {
      const res = await fetch("/api/vocabulary");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ items: VocabItem[] }>;
    },
  });
  const exprQuery = useQuery({
    queryKey: ["expressions"],
    queryFn: async () => {
      const res = await fetch("/api/expressions/save");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ items: ExpressionItem[] }>;
    },
  });

  if (vocabQuery.isLoading || exprQuery.isLoading) {
    return <p className="text-muted">Loading vocabulary...</p>;
  }

  const items = vocabQuery.data?.items || [];
  const expressions = exprQuery.data?.items || [];

  return (
    <div className="space-y-8 animate-rise">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
          Personal lexicon
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          Vocabulary
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Words and expressions you save enter spaced repetition. Practice them
          here, then continue from Review or your Daily Plan.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/review">
            <Button variant="soft" size="sm">
              Open Review
            </Button>
          </Link>
          <Link href="/practice?skill=vocabulary">
            <Button variant="outline" size="sm">
              Practice vocabulary
            </Button>
          </Link>
          <Link href="/practice?skill=expression">
            <Button variant="outline" size="sm">
              Practice expressions
            </Button>
          </Link>
          <Link href="/home">
            <Button variant="outline" size="sm">
              Daily Plan
            </Button>
          </Link>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">
          Words
        </h2>
        {items.length === 0 ? (
          <EmptyState
            title="No words saved yet"
            description="Open a reading passage, click any word, and tap Save Word."
            action={
              <Link href="/read">
                <Button>Go to Reading</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-4 rounded-[1.25rem] border border-line bg-surface px-4 py-4 shadow-[var(--shadow-soft)]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xl font-semibold text-ink">{item.word}</p>
                    <Badge tone="teal">{item.partOfSpeech}</Badge>
                    <Badge>{item.status}</Badge>
                    <Badge tone="neutral">{item.level}</Badge>
                  </div>
                  <p className="mt-1 text-teal-deep">{item.translation}</p>
                  {item.phonetic ? (
                    <p className="text-sm text-muted">{item.phonetic}</p>
                  ) : null}
                  {item.exampleSentence ? (
                    <p className="mt-2 text-sm text-ink-soft">
                      {item.exampleSentence}
                      {item.exampleTranslation
                        ? ` — ${item.exampleTranslation}`
                        : ""}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted">
                    Mastery {Math.round(item.masteryScore)}%
                  </p>
                </div>
                <Button
                  variant="soft"
                  size="icon"
                  onClick={() => audio.speak(item.word)}
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">
            Expressions
          </h2>
          <Link href="/practice?skill=expression">
            <Button variant="soft" size="sm">
              Practice expressions
            </Button>
          </Link>
        </div>
        {expressions.length === 0 ? (
          <EmptyState
            title="No expressions saved yet"
            description="When reading, save multi-word phrases to review them later."
            action={
              <Link href="/read">
                <Button>Go to Reading</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3">
            {expressions.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-4 rounded-[1.25rem] border border-line bg-surface px-4 py-4 shadow-[var(--shadow-soft)]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xl font-semibold text-ink">
                      {item.expression}
                    </p>
                    <Badge tone="teal">expression</Badge>
                    <Badge>{item.status}</Badge>
                    <Badge tone="neutral">{item.level}</Badge>
                  </div>
                  <p className="mt-1 text-teal-deep">{item.translation}</p>
                  {item.example ? (
                    <p className="mt-2 text-sm text-ink-soft">
                      {item.example}
                      {item.exampleTranslation
                        ? ` — ${item.exampleTranslation}`
                        : ""}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted">
                    Mastery {Math.round(item.masteryScore)}%
                  </p>
                </div>
                <Button
                  variant="soft"
                  size="icon"
                  onClick={() => audio.speak(item.expression)}
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
