"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAudioService } from "@/services/audio/AudioService";
import Link from "next/link";
import { Volume2 } from "lucide-react";

type ReviewItem = {
  reviewId: string;
  itemType: string;
  itemId: string;
  masteryScore: number;
  prompt: string;
  word?: string;
  expression?: string;
  sentence?: string;
  translation?: string;
  example?: string;
  phonetic?: string | null;
  category?: string;
  level?: string | null;
  pattern?: string;
  examples?: string[];
  exercise?: {
    id: string;
    prompt: string;
    options?: string[];
    answer: string | string[];
  } | null;
  userInput?: string;
  correctForm?: string;
  errorType?: string;
};

export default function ReviewPage() {
  const audio = getAudioService();
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState("");
  const [done, setDone] = useState(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["review-due"],
    queryFn: async () => {
      const res = await fetch("/api/review/due");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{
        dueCount: number;
        upcomingCount: number;
        items: ReviewItem[];
      }>;
    },
  });

  const items = data?.items || [];
  const current = items[index];

  const completeMutation = useMutation({
    mutationFn: async (grade: number) => {
      const res = await fetch("/api/review/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: current.reviewId,
          grade,
          userAnswer: answer,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: async () => {
      setDone((v) => v + 1);
      setRevealed(false);
      setAnswer("");
      await queryClient.invalidateQueries({ queryKey: ["daily-plan"] });
      await queryClient.invalidateQueries({ queryKey: ["progress"] });
      if (index + 1 >= items.length) {
        await queryClient.invalidateQueries({ queryKey: ["review-due"] });
        await refetch();
        setIndex(0);
      } else {
        setIndex((v) => v + 1);
      }
    },
  });

  const gradeHint = useMemo(() => {
    if (!current || !revealed) return null;
    if (
      current.itemType === "VOCABULARY" ||
      current.itemType === "EXPRESSION" ||
      current.itemType === "SENTENCE"
    ) {
      const expected = (current.translation || "").trim().toLowerCase();
      if (!expected) return 4;
      const ok = answer.trim().toLowerCase() === expected;
      return ok ? 5 : 2;
    }
    if (current.itemType === "MISTAKE") {
      const ok =
        answer.trim().toLowerCase() ===
        (current.correctForm || "").trim().toLowerCase();
      return ok ? 5 : 1;
    }
    if (current.exercise) {
      const expected = String(current.exercise.answer).toLowerCase();
      return answer.trim().toLowerCase() === expected ? 5 : 2;
    }
    return 4;
  }, [answer, current, revealed]);

  if (isLoading) return <p className="text-muted">Loading review queue...</p>;

  if (!items.length) {
    return (
      <div className="space-y-6 animate-rise">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
            Spaced repetition
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
            Review
          </h1>
        </div>
        <EmptyState
          title={done > 0 ? "All caught up" : "Nothing due right now"}
          description={
            done > 0
              ? `You reviewed ${done} item${done === 1 ? "" : "s"}. Upcoming: ${data?.upcomingCount || 0}.`
              : `Upcoming scheduled items: ${data?.upcomingCount || 0}. Save words and expressions from reading to fill this queue.`
          }
          action={
            <Link href="/read">
              <Button>Go to Reading</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const displayPhrase =
    current.expression ||
    current.word ||
    current.sentence ||
    "";

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-rise">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
          Spaced repetition
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          Review
        </h1>
        <p className="mt-2 text-muted">
          {index + 1} / {items.length} due · mastery{" "}
          {Math.round(current.masteryScore)}%
        </p>
      </div>

      <div className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-[var(--shadow-soft)]">
        <Badge>{current.itemType}</Badge>
        <h2 className="mt-4 text-2xl font-semibold text-ink">{current.prompt}</h2>

        {current.itemType === "VOCABULARY" ||
        current.itemType === "EXPRESSION" ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <p className="brand-mark text-3xl text-ink">{displayPhrase}</p>
              <Button
                variant="soft"
                size="icon"
                onClick={() => audio.speak(displayPhrase)}
              >
                <Volume2 className="h-4 w-4" />
              </Button>
            </div>
            {current.phonetic ? (
              <p className="text-muted">{current.phonetic}</p>
            ) : null}
            {current.category ? (
              <Badge tone="teal">{current.category}</Badge>
            ) : null}
            <input
              className="h-11 w-full rounded-xl border border-line px-3 text-sm"
              placeholder="Type the Italian meaning"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            {revealed ? (
              <div className="rounded-2xl bg-teal-soft p-4 text-teal-deep">
                <p className="font-semibold">{current.translation}</p>
                {current.example ? (
                  <p className="mt-1 text-sm">{current.example}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {current.itemType === "SENTENCE" ? (
          <div className="mt-4 space-y-3">
            <p className="reading-text text-xl text-ink">{displayPhrase}</p>
            <Button
              variant="soft"
              size="sm"
              onClick={() => audio.speak(displayPhrase)}
            >
              <Volume2 className="h-4 w-4" /> Listen
            </Button>
            <input
              className="h-11 w-full rounded-xl border border-line px-3 text-sm"
              placeholder="Type the meaning / translation"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            {revealed ? (
              <div className="rounded-2xl bg-teal-soft p-4 text-teal-deep">
                <p className="font-semibold">
                  {current.translation || "Review complete — rate yourself"}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {current.itemType === "GRAMMAR" ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-2xl bg-sand px-4 py-3 font-medium text-ink">
              {current.pattern}
            </p>
            {current.exercise ? (
              <>
                <p className="text-sm text-muted">{current.exercise.prompt}</p>
                {current.exercise.options ? (
                  <div className="space-y-2">
                    {current.exercise.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setAnswer(option)}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                          answer === option
                            ? "border-teal bg-teal-soft"
                            : "border-line"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    className="h-11 w-full rounded-xl border border-line px-3 text-sm"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                )}
              </>
            ) : null}
            {revealed ? (
              <p className="text-sm text-teal-deep">
                Answer: {String(current.exercise?.answer || "")}
              </p>
            ) : null}
          </div>
        ) : null}

        {current.itemType === "MISTAKE" ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-warning">
              You wrote: {current.userInput}
            </p>
            <input
              className="h-11 w-full rounded-xl border border-line px-3 text-sm"
              placeholder="Write the correct form"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            {revealed ? (
              <p className="rounded-2xl bg-teal-soft px-4 py-3 text-teal-deep">
                Correct: {current.correctForm}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {!revealed ? (
            <Button onClick={() => setRevealed(true)}>Check</Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  completeMutation.mutate(
                    gradeHint && gradeHint < 3 ? gradeHint : 2
                  )
                }
              >
                Again
              </Button>
              <Button
                variant="soft"
                onClick={() => completeMutation.mutate(3)}
              >
                Hard
              </Button>
              <Button
                onClick={() =>
                  completeMutation.mutate(
                    gradeHint && gradeHint >= 4 ? gradeHint : 4
                  )
                }
              >
                Good
              </Button>
              <Button
                variant="secondary"
                onClick={() => completeMutation.mutate(5)}
              >
                Easy
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
