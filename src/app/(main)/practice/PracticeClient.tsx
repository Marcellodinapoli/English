"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ExercisePlayer } from "@/components/exercises/ExercisePlayer";
import type { PersonalizedExercise } from "@/types/practice";
import type { ExerciseItem } from "@/types/content";
import { useRouter, useSearchParams } from "next/navigation";
import { invalidateLearningQueries } from "@/lib/invalidateLearning";

type SessionResponse = {
  provider: string;
  focus?: { skill: string | null; focus: string | null };
  sources: {
    currentLevel: string;
    weakestSkills: string[];
    dueCount: number;
    targetCount: number;
    topTargets: Array<{ label: string; kind: string; priority: number }>;
  };
  items: PersonalizedExercise[];
};

export default function PracticeClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const skillParam = searchParams.get("skill") || undefined;
  const focusParam = searchParams.get("focus") || undefined;
  const [startedAt] = useState(() => Date.now());
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [outcome, setOutcome] = useState<{
    score: number;
    correctCount: number;
    total: number;
    masteryUpdates: Record<string, number>;
  } | null>(null);

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/learning/practice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: 5,
          provider: "rule",
          skill: skillParam,
          focus: focusParam,
        }),
      });
      if (!res.ok) throw new Error("Could not build practice session");
      return res.json() as Promise<SessionResponse>;
    },
    onSuccess: (body) => {
      setOutcome(null);
      setSession(body);
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (
      attempts: Array<{ exerciseId: string; userAnswer: string | string[] }>
    ) => {
      const res = await fetch("/api/learning/practice/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: session?.items || [],
          attempts,
          durationMs: Date.now() - startedAt,
          provider: session?.provider || "rule",
        }),
      });
      if (!res.ok) throw new Error("Could not save practice");
      return res.json();
    },
    onSuccess: async (body) => {
      setOutcome({
        score: body.result.score,
        correctCount: body.result.correctCount,
        total: body.result.total,
        masteryUpdates: body.masteryUpdates || {},
      });
      await invalidateLearningQueries(queryClient);
    },
  });

  const exercises: ExerciseItem[] = useMemo(
    () => (session?.items || []).map((i) => i.exercise),
    [session]
  );

  if (outcome) {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border border-line bg-surface p-8 text-center shadow-[var(--shadow-soft)] animate-rise">
        <Badge tone="success">Practice complete</Badge>
        <h1 className="mt-4 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          {outcome.score}%
        </h1>
        <p className="mt-2 text-muted">
          {outcome.correctCount}/{outcome.total} correct · mistakes went to Review
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={() => startMutation.mutate()}>
            Another set
          </Button>
          <Button onClick={() => router.push("/home")}>Back to Home</Button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-xl space-y-6 animate-rise">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
            Personalized practice
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
            Practice
          </h1>
          <p className="mt-2 text-muted">
            {skillParam
              ? `Focused on ${skillParam}${focusParam ? ` · “${focusParam}”` : ""}.`
              : "Exercises built from due reviews, errors and weak items."}
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
        >
          {startMutation.isPending ? "Building set..." : "Start practice"}
        </Button>
        {startMutation.isError ? (
          <p className="text-sm text-danger">Could not start practice.</p>
        ) : null}
      </div>
    );
  }

  if (!exercises.length) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <p className="text-muted">
          Not enough saved words, expressions or errors yet. Read a passage and
          save a few items first.
        </p>
        <Button onClick={() => router.push("/read")}>Go to Reading</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-rise">
      <div>
        <Badge tone="teal">
          {session.focus?.skill ||
            (session.provider === "rule" ? "Rule-based" : session.provider)}
        </Badge>
        <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-3xl text-ink">
          Your set
        </h1>
        <p className="mt-2 text-muted">
          Level {session.sources.currentLevel}
          {session.focus?.focus ? ` · focus “${session.focus.focus}”` : ""}
        </p>
      </div>
      <ExercisePlayer
        exercises={exercises}
        onComplete={(attempts) => completeMutation.mutate(attempts)}
      />
    </div>
  );
}
