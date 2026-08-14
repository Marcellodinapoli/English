"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SpeakingRecorder } from "@/components/speaking/SpeakingRecorder";
import type { SpeakingContent } from "@/types/speaking";
import type { SpeakingEvaluationResult } from "@/services/ai/AIProvider";
import {
  fetchCurriculumJson,
  isForbiddenError,
  PremiumRequiredPanel,
} from "@/components/subscription/PremiumRequiredPanel";
import { invalidateLearningQueries } from "@/lib/invalidateLearning";

export default function SpeakSessionPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [anyPronunciationAssessed, setAnyPronunciationAssessed] =
    useState(false);
  const [anySpeakingEvaluated, setAnySpeakingEvaluated] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["speaking", params.id],
    queryFn: async () =>
      fetchCurriculumJson<{ item: SpeakingContent }>(
        `/api/content/speaking/${params.id}`
      ),
  });

  if (isLoading) return <p className="text-muted">Loading session...</p>;
  if (isForbiddenError(error)) {
    return <PremiumRequiredPanel title="This speaking session is Premium" />;
  }
  if (!data?.item) return <p className="text-danger">Session not found.</p>;

  const session = data.item;
  const current = session.items[index];
  const progress = Math.round(
    ((index + (doneCount > index ? 1 : 0)) / session.items.length) * 100
  );

  async function handleEvaluated(result: SpeakingEvaluationResult) {
    setDoneCount((v) => Math.max(v, index + 1));
    setAnySpeakingEvaluated(true);
    if (result.pronunciationAssessed) {
      setAnyPronunciationAssessed(true);
    }
    await invalidateLearningQueries(queryClient);
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border border-line bg-surface p-8 text-center animate-rise">
        <Badge tone="success">Speaking complete</Badge>
        <h1 className="mt-4 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          Great work
        </h1>
        <p className="mt-2 text-muted">
          {anySpeakingEvaluated
            ? "Your speaking scores were updated."
            : "Session finished."}
        </p>
        {anySpeakingEvaluated && !anyPronunciationAssessed ? (
          <p className="mt-2 text-sm text-muted">
            Pronunciation was not scored in offline mode — only speaking
            (accuracy, fluency, vocabulary, grammar) was assessed.
          </p>
        ) : null}
        {anyPronunciationAssessed ? (
          <p className="mt-2 text-sm text-muted">
            Pronunciation was also assessed for this session.
          </p>
        ) : null}
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
        <div className="mt-4">
          <ProgressBar value={progress} />
          <p className="mt-2 text-xs text-muted">
            Prompt {index + 1} of {session.items.length}
          </p>
        </div>
      </div>

      <SpeakingRecorder
        key={current.id}
        item={current}
        level={session.level}
        onEvaluated={handleEvaluated}
      />

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={index === 0}
          onClick={() => setIndex((v) => v - 1)}
        >
          Back
        </Button>
        <Button
          onClick={() => setIndex((v) => v + 1)}
          disabled={doneCount < index + 1}
        >
          {index + 1 >= session.items.length ? "Finish" : "Next prompt"}
        </Button>
      </div>
    </div>
  );
}
