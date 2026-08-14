"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { InteractiveText } from "@/components/reading/InteractiveText";
import { ExercisePlayer } from "@/components/exercises/ExercisePlayer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getAudioService } from "@/services/audio/AudioService";
import type { PassageContent } from "@/types/content";
import type { ComprehensionSet, ExpressionDef } from "@/types/expression";
import { comprehensionToExercise } from "@/lib/comprehension";
import {
  fetchCurriculumJson,
  isForbiddenError,
  PremiumRequiredPanel,
} from "@/components/subscription/PremiumRequiredPanel";
import { invalidateLearningQueries } from "@/lib/invalidateLearning";

type PassageResponse = {
  passage: PassageContent;
  expressions: Array<
    Array<{ start: number; end: number; expression: ExpressionDef }>
  >;
  comprehension: ComprehensionSet | null;
};

export default function ReadPassagePage() {
  const params = useParams<{ contentId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const audio = getAudioService();
  const [phase, setPhase] = useState<"read" | "comprehension" | "done">("read");
  const [startedAt] = useState(() => Date.now());
  const [compResult, setCompResult] = useState<{
    score: number;
    correctCount: number;
    total: number;
    readingScore?: number;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["passage", params.contentId],
    queryFn: async () =>
      fetchCurriculumJson<PassageResponse>(
        `/api/content/reading/${params.contentId}`
      ),
  });

  const catalog = useMemo(() => {
    const map = new Map<string, ExpressionDef>();
    for (const spans of data?.expressions || []) {
      for (const s of spans) map.set(s.expression.id, s.expression);
    }
    return [...map.values()];
  }, [data?.expressions]);

  const exercises = useMemo(() => {
    return (data?.comprehension?.questions || []).map(comprehensionToExercise);
  }, [data?.comprehension]);

  const completeMutation = useMutation({
    mutationFn: async (
      attempts: Array<{ exerciseId: string; userAnswer: string | string[] }>
    ) => {
      const res = await fetch("/api/learning/reading/comprehension/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passageId: params.contentId,
          durationMs: Date.now() - startedAt,
          attempts,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: async (body) => {
      setCompResult({
        score: body.result.score,
        correctCount: body.result.correctCount,
        total: body.result.total,
        readingScore: body.readingScore,
      });
      setPhase("done");
      await invalidateLearningQueries(queryClient);
    },
  });

  if (isLoading) return <p className="text-muted">Loading passage...</p>;
  if (isForbiddenError(error)) {
    return <PremiumRequiredPanel title="This text is Premium" />;
  }
  if (error || !data?.passage) {
    return <p className="text-danger">Passage not found.</p>;
  }

  const passage = data.passage;
  const fullText = passage.sentences.map((s) => s.text).join(" ");

  if (phase === "done" && compResult) {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border border-line bg-surface p-8 text-center shadow-[var(--shadow-soft)] animate-rise">
        <Badge tone="success">Comprehension complete</Badge>
        <h1 className="mt-4 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          {compResult.score}%
        </h1>
        <p className="mt-2 text-muted">
          {compResult.correctCount}/{compResult.total} correct
          {compResult.readingScore != null
            ? ` · reading mastery ${Math.round(compResult.readingScore)}%`
            : ""}
        </p>
        <p className="mt-2 text-sm text-muted">
          Mistakes were added to your Review queue when needed.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={() => setPhase("read")}>
            Back to text
          </Button>
          <Button onClick={() => router.push("/review")}>
            Go to Review
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "comprehension") {
    if (!exercises.length) {
      return (
        <div className="mx-auto max-w-xl space-y-4">
          <p className="text-muted">No comprehension questions for this passage yet.</p>
          <Button onClick={() => setPhase("read")}>Back to reading</Button>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-3xl space-y-6 animate-rise">
        <div>
          <Badge tone="teal">Comprehension</Badge>
          <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-3xl text-ink">
            Check your understanding
          </h1>
          <p className="mt-2 text-muted">
            Questions about “{passage.title}”. Wrong answers go to Review.
          </p>
        </div>
        <ExercisePlayer
          exercises={exercises}
          onComplete={(attempts) => completeMutation.mutate(attempts)}
        />
        {completeMutation.isPending ? (
          <p className="text-sm text-muted">Saving results...</p>
        ) : null}
        <Button variant="ghost" onClick={() => setPhase("read")}>
          Back to reading
        </Button>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-3xl space-y-6 animate-rise">
      <div>
        <Badge tone="teal">{passage.level}</Badge>
        <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          {passage.title}
        </h1>
        {passage.titleIt ? (
          <p className="mt-2 text-muted">{passage.titleIt}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            audio.setSpeed(0.75);
            audio.speak(fullText);
          }}
        >
          Slow 0.75x
        </Button>
        <Button
          variant="soft"
          onClick={() => {
            audio.setSpeed(1);
            audio.speak(fullText);
          }}
        >
          Normal 1x
        </Button>
        <Button variant="ghost" onClick={() => audio.repeat()}>
          Repeat
        </Button>
        {data.comprehension ? (
          <Button onClick={() => setPhase("comprehension")}>
            Comprehension
          </Button>
        ) : null}
      </div>

      {catalog.length > 0 ? (
        <p className="text-sm text-muted">
          Tip: multi-word expressions (underlined) open as a single unit.
        </p>
      ) : null}

      <div className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-[var(--shadow-soft)] md:p-8">
        <InteractiveText
          sentences={passage.sentences}
          level={passage.level}
          sourceContentId={passage.id}
          expressionCatalog={catalog}
        />
      </div>
    </div>
  );
}
