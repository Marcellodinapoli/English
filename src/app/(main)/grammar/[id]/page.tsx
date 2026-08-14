"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ExercisePlayer } from "@/components/exercises/ExercisePlayer";
import type { GrammarTopic } from "@/types/listening-grammar";
import {
  fetchCurriculumJson,
  isForbiddenError,
  PremiumRequiredPanel,
} from "@/components/subscription/PremiumRequiredPanel";
import { invalidateLearningQueries } from "@/lib/invalidateLearning";

const STEPS = ["examples", "pattern", "explanation", "exercise", "realUse"] as const;

export default function GrammarTopicPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ score: number } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["grammar", params.id],
    queryFn: async () =>
      fetchCurriculumJson<{ item: GrammarTopic }>(
        `/api/content/grammar/${params.id}`
      ),
  });

  const completeMutation = useMutation({
    mutationFn: async (
      attempts: Array<{ exerciseId: string; userAnswer: string | string[] }>
    ) => {
      const res = await fetch("/api/learning/grammar/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grammarId: params.id, attempts }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: async (body) => {
      setResult({ score: body.result.score });
      setStep(4);
      await invalidateLearningQueries(queryClient);
    },
  });

  if (isLoading) return <p className="text-muted">Loading grammar...</p>;
  if (isForbiddenError(error)) {
    return <PremiumRequiredPanel title="This grammar topic is Premium" />;
  }
  if (!data?.item) return <p className="text-danger">Topic not found.</p>;

  const topic = data.item;
  const current = STEPS[step];

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-rise">
      <div>
        <Badge tone="teal">{topic.level}</Badge>
        <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          {topic.title}
        </h1>
        {topic.titleIt ? <p className="mt-2 text-muted">{topic.titleIt}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                i === step
                  ? "bg-teal text-white"
                  : i < step
                    ? "bg-teal-soft text-teal-deep"
                    : "bg-sand text-muted"
              }`}
            >
              {s === "realUse" ? "real use" : s}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-[var(--shadow-soft)]">
        {current === "examples" ? (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Examples</h2>
            {topic.examples.map((ex) => (
              <p key={ex} className="reading-text text-ink">
                {ex}
              </p>
            ))}
          </div>
        ) : null}

        {current === "pattern" ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-ink">Pattern</h2>
            <div className="rounded-2xl bg-teal-soft px-4 py-4 text-lg font-semibold text-teal-deep">
              {topic.pattern}
            </div>
          </div>
        ) : null}

        {current === "explanation" ? (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Explanation</h2>
            <p className="leading-relaxed text-muted">{topic.explanation}</p>
            {topic.explanationIt ? (
              <p className="text-sm text-muted/80">{topic.explanationIt}</p>
            ) : null}
          </div>
        ) : null}

        {current === "exercise" ? (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-ink">Exercise</h2>
            <ExercisePlayer
              exercises={topic.exercises}
              onComplete={(attempts) => completeMutation.mutate(attempts)}
            />
          </div>
        ) : null}

        {current === "realUse" ? (
          <div className="space-y-4">
            {result ? (
              <Badge tone="success">Score {result.score}%</Badge>
            ) : null}
            <h2 className="text-xl font-semibold text-ink">Real use</h2>
            <ul className="space-y-2">
              {topic.realUse.map((line) => (
                <li
                  key={line}
                  className="rounded-xl bg-sand/70 px-4 py-3 text-sm font-medium text-ink"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="flex justify-between gap-3">
        <Button
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep((v) => Math.max(0, v - 1))}
        >
          Back
        </Button>
        {current !== "exercise" && current !== "realUse" ? (
          <Button onClick={() => setStep((v) => v + 1)}>Continue</Button>
        ) : null}
        {current === "realUse" ? (
          <Button onClick={() => (window.location.href = "/grammar")}>
            Done
          </Button>
        ) : null}
      </div>
    </div>
  );
}