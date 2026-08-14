"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ExercisePlayer } from "@/components/exercises/ExercisePlayer";
import { getAudioService } from "@/services/audio/AudioService";
import type { ListeningContent } from "@/types/listening-grammar";
import type { ExerciseItem } from "@/types/content";
import { RotateCcw, Volume2 } from "lucide-react";
import {
  fetchCurriculumJson,
  isForbiddenError,
  PremiumRequiredPanel,
} from "@/components/subscription/PremiumRequiredPanel";
import { invalidateLearningQueries } from "@/lib/invalidateLearning";

export default function ListenSessionPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const audio = getAudioService();
  const [result, setResult] = useState<{
    score: number;
    correctCount: number;
    total: number;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["listening", params.id],
    queryFn: async () =>
      fetchCurriculumJson<{ item: ListeningContent }>(
        `/api/content/listening/${params.id}`
      ),
  });

  const completeMutation = useMutation({
    mutationFn: async (
      attempts: Array<{ exerciseId: string; userAnswer: string | string[] }>
    ) => {
      const res = await fetch("/api/learning/listening/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listeningId: params.id, attempts }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: async (body) => {
      setResult(body.result);
      await invalidateLearningQueries(queryClient);
    },
  });

  if (isLoading) return <p className="text-muted">Loading session...</p>;
  if (isForbiddenError(error)) {
    return <PremiumRequiredPanel title="This listening session is Premium" />;
  }
  if (!data?.item) return <p className="text-danger">Listening not found.</p>;

  const item = data.item;
  const exercises: ExerciseItem[] = item.items.map((ex) => ({
    id: ex.id,
    type:
      ex.type === "listen_complete" || ex.type === "dictation"
        ? "fill_blank"
        : ex.type === "listen_order"
          ? "reorder"
          : "multiple_choice",
    prompt: ex.prompt,
    promptIt: ex.promptIt,
    options: ex.options,
    answer: ex.answer,
    explanation: ex.explanation,
  }));

  function play(text: string, speed: 0.75 | 1 | 1.25) {
    audio.setSpeed(speed);
    audio.speak(text);
  }

  if (result) {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border border-line bg-surface p-8 text-center shadow-[var(--shadow-soft)] animate-rise">
        <Badge tone="success">Listening complete</Badge>
        <h1 className="mt-4 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          {result.score}%
        </h1>
        <p className="mt-2 text-muted">
          {result.correctCount}/{result.total} correct · listening mastery updated
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button variant="outline" onClick={() => setResult(null)}>
            Retry
          </Button>
          <Button onClick={() => (window.location.href = "/listen")}>
            More listening
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-rise">
      <div>
        <Badge tone="teal">{item.level}</Badge>
        <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          {item.title}
        </h1>
        <p className="mt-2 text-muted">{item.description}</p>
      </div>

      <div className="rounded-[1.75rem] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
        <p className="text-sm font-semibold text-ink">Audio controls</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => play(item.audioText, 0.75)}>
            0.75x
          </Button>
          <Button variant="soft" onClick={() => play(item.audioText, 1)}>
            <Volume2 className="h-4 w-4" /> 1x
          </Button>
          <Button variant="outline" onClick={() => play(item.audioText, 1.25)}>
            1.25x
          </Button>
          <Button variant="ghost" onClick={() => audio.repeat()}>
            <RotateCcw className="h-4 w-4" /> Repeat
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted">
          Tip: listen first, then answer. Use Slow if needed.
        </p>
      </div>

      <div className="rounded-[1.75rem] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-4 space-y-2">
          {item.items.map((ex) => (
            <button
              key={ex.id}
              type="button"
              className="mr-2 rounded-full bg-sand px-3 py-1 text-xs font-medium text-ink hover:bg-teal-soft"
              onClick={() => play(ex.transcript, 1)}
            >
              Play clip · {ex.type.split("_").join(" ")}
            </button>
          ))}
        </div>
        <ExercisePlayer
          exercises={exercises}
          onComplete={(attempts) => completeMutation.mutate(attempts)}
        />
      </div>
    </div>
  );
}