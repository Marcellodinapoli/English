"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Input";
import { SkillBar } from "@/components/ui/ProgressBar";
import type { WritingContent } from "@/types/speaking";
import type { WritingEvaluationResult } from "@/services/ai/AIProvider";
import {
  fetchCurriculumJson,
  isForbiddenError,
  PremiumRequiredPanel,
} from "@/components/subscription/PremiumRequiredPanel";
import { invalidateLearningQueries } from "@/lib/invalidateLearning";

export default function WritingSessionPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [evaluation, setEvaluation] = useState<WritingEvaluationResult | null>(
    null
  );
  const [evaluatedIndexes, setEvaluatedIndexes] = useState<Set<number>>(
    () => new Set()
  );
  const [finished, setFinished] = useState(false);
  const [abandonConfirm, setAbandonConfirm] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["writing", params.id],
    queryFn: async () =>
      fetchCurriculumJson<{ item: WritingContent }>(
        `/api/content/writing/${params.id}`
      ),
  });

  const evaluate = useMutation({
    mutationFn: async () => {
      const item = data!.item.items[index];
      const res = await fetch("/api/ai/evaluate-writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          prompt: item.prompt,
          level: data!.item.level,
          writingId: data!.item.id,
          itemId: item.id,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed");
      return body.evaluation as WritingEvaluationResult;
    },
    onSuccess: async (result) => {
      setEvaluation(result);
      setEvaluatedIndexes((prev) => new Set(prev).add(index));
      await invalidateLearningQueries(queryClient);
    },
  });

  if (isLoading) return <p className="text-muted">Loading writing...</p>;
  if (isForbiddenError(error)) {
    return <PremiumRequiredPanel title="This writing task is Premium" />;
  }
  if (!data?.item) return <p className="text-danger">Not found.</p>;

  const session = data.item;
  const current = session.items[index];
  const currentEvaluated = evaluatedIndexes.has(index);
  const allEvaluated = session.items.every((_, i) => evaluatedIndexes.has(i));

  if (finished) {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border border-line bg-surface p-8 text-center animate-rise">
        <Badge tone="success">Writing session closed</Badge>
        <h1 className="mt-4 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          {allEvaluated ? "Well done" : "Session incomplete"}
        </h1>
        <p className="mt-2 text-muted">
          {allEvaluated
            ? "Evaluated writing updated mastery and Review when mistakes were found."
            : "Only evaluated tasks were saved. Unevaluated drafts did not change mastery or XP."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/home">
            <Button>Continue on Home</Button>
          </Link>
          <Link href="/speak">
            <Button variant="outline">Back to Speak</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-rise">
      <div>
        <Badge tone="teal">{session.level}</Badge>
        <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          {session.title}
        </h1>
        <p className="mt-2 text-muted">{session.description}</p>
      </div>

      <div className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-[var(--shadow-soft)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Task {index + 1}/{session.items.length}
          {currentEvaluated ? " · evaluated" : " · not evaluated yet"}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-ink">{current.prompt}</h2>
        {current.promptIt ? (
          <p className="mt-1 text-sm text-muted">{current.promptIt}</p>
        ) : null}
        {current.hints?.length ? (
          <ul className="mt-3 space-y-1 text-sm text-teal-deep">
            {current.hints.map((h) => (
              <li key={h}>• {h}</li>
            ))}
          </ul>
        ) : null}

        <div className="mt-5">
          <TextArea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setEvaluation(null);
            }}
            placeholder="Write your answer in English..."
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            disabled={!text.trim() || evaluate.isPending}
            onClick={() => evaluate.mutate()}
          >
            {evaluate.isPending ? "Evaluating..." : "Evaluate writing"}
          </Button>
          {index + 1 < session.items.length ? (
            <Button
              variant="outline"
              disabled={!currentEvaluated}
              onClick={() => {
                setIndex((v) => v + 1);
                setText("");
                setEvaluation(null);
                setAbandonConfirm(false);
              }}
            >
              Next task
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={!currentEvaluated}
              onClick={() => setFinished(true)}
            >
              Finish session
            </Button>
          )}
          {!abandonConfirm ? (
            <Button
              variant="soft"
              onClick={() => setAbandonConfirm(true)}
            >
              Leave without finishing
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setFinished(true)}
            >
              Confirm leave (unevaluated drafts are discarded)
            </Button>
          )}
        </div>
        {!currentEvaluated ? (
          <p className="mt-3 text-sm text-muted">
            Evaluate this task before moving on. Leaving without Evaluate does
            not award mastery, Review items, or XP for that draft.
          </p>
        ) : null}
      </div>

      {evaluation ? (
        <div className="space-y-4 rounded-[1.5rem] border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ink">Feedback</h3>
            <Badge tone="success">{evaluation.overall}%</Badge>
          </div>
          <div className="space-y-3">
            <SkillBar label="Grammar" value={evaluation.grammar} />
            <SkillBar label="Vocabulary" value={evaluation.vocabulary} />
            <SkillBar label="Accuracy" value={evaluation.accuracy} />
            <SkillBar label="Fluency" value={evaluation.fluency} />
          </div>
          <p>{evaluation.feedback}</p>
          {evaluation.correctedText ? (
            <div className="rounded-2xl bg-teal-soft p-4 text-teal-deep">
              <p className="text-xs font-semibold uppercase tracking-wide">
                Suggested version
              </p>
              <p className="mt-2">{evaluation.correctedText}</p>
            </div>
          ) : null}
          {evaluation.mistakes.length ? (
            <ul className="space-y-1 text-sm text-warning">
              {evaluation.mistakes.map((m) => (
                <li key={`${m.original}-${m.correction}`}>
                  {m.original} → {m.correction} ({m.type})
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
