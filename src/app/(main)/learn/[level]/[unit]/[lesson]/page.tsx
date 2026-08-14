"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { InteractiveText } from "@/components/reading/InteractiveText";
import { ExercisePlayer } from "@/components/exercises/ExercisePlayer";
import { getAudioService } from "@/services/audio/AudioService";
import type {
  LessonContent,
  LessonStepDef,
  PassageContent,
} from "@/types/content";
import type { ComprehensionSet, ExpressionDef } from "@/types/expression";
import { Volume2 } from "lucide-react";
import type { StepResult } from "@/types/learning";
import { comprehensionToExercise } from "@/lib/comprehension";
import {
  fetchCurriculumJson,
  isForbiddenError,
  PremiumRequiredPanel,
} from "@/components/subscription/PremiumRequiredPanel";

export default function LessonPage() {
  const params = useParams<{
    level: string;
    unit: string;
    lesson: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const audio = getAudioService();
  const [stepIndex, setStepIndex] = useState(0);
  const [exerciseAnswers, setExerciseAnswers] = useState<Record<string, string>>(
    {}
  );
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [finished, setFinished] = useState(false);
  const [progression, setProgression] = useState<{
    promoted?: boolean;
    previousLevel?: string;
    currentLevel?: string;
    subLevel?: number;
    blockers?: string[];
  } | null>(null);
  const [assessment, setAssessment] = useState<{
    quality: string;
    summary: string;
    needsRemediation: boolean;
  } | null>(null);
  const [nextBest, setNextBest] = useState<{
    href: string;
    title: string;
    reason: string;
  } | null>(null);
  const [remediationHint, setRemediationHint] = useState<string | null>(null);
  const [comprehensionStartedAt] = useState(() => Date.now());

  type PassageResponse = {
    passage: PassageContent;
    comprehension: ComprehensionSet | null;
    expressions?: Array<
      Array<{ start: number; end: number; expression: ExpressionDef }>
    >;
  };

  const lessonQuery = useQuery({
    queryKey: ["lesson", params.lesson],
    queryFn: async () =>
      fetchCurriculumJson<{ lesson: LessonContent }>(
        `/api/content/lessons/${params.lesson}`
      ),
  });

  const lesson = lessonQuery.data?.lesson;

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/learning/lesson/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: params.lesson,
          unitId: params.unit,
          levelId: params.level,
        }),
      });
      if (res.status === 403) {
        const err = new Error("premium_required") as Error & { status: number };
        err.status = 403;
        throw err;
      }
      if (!res.ok) throw new Error("Could not start lesson");
      return res.json() as Promise<{ steps: LessonStepDef[] }>;
    },
  });

  const readingRef =
    lesson?.readingRef ||
    lesson?.steps.find((s) => s.type === "reading")?.contentRef;

  const steps: LessonStepDef[] = startMutation.data?.steps ?? [];
  const current = steps[stepIndex];
  const activePassageRef =
    current?.type === "reading" || current?.type === "comprehension"
      ? current.contentRef
      : readingRef;
  const progress = steps.length
    ? Math.round((stepIndex / steps.length) * 100)
    : 0;

  const passageQuery = useQuery({
    queryKey: ["passage", activePassageRef],
    enabled: Boolean(activePassageRef && activePassageRef !== "self"),
    queryFn: async () =>
      fetchCurriculumJson<PassageResponse>(
        `/api/content/reading/${activePassageRef}`
      ),
  });

  const comprehensionExercises = useMemo(() => {
    return (passageQuery.data?.comprehension?.questions || []).map(
      comprehensionToExercise
    );
  }, [passageQuery.data?.comprehension]);

  const comprehensionMutation = useMutation({
    mutationFn: async (
      attempts: Array<{ exerciseId: string; userAnswer: string | string[] }>
    ) => {
      const res = await fetch("/api/learning/reading/comprehension/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passageId: activePassageRef,
          lessonId: params.lesson,
          durationMs: Date.now() - comprehensionStartedAt,
          attempts,
        }),
      });
      if (!res.ok) throw new Error("Comprehension save failed");
      return res.json();
    },
    onSuccess: (body) => {
      if (!current) return;
      const wrongIds = body.result.evaluations
        .filter((e: { correct: boolean }) => !e.correct)
        .map((e: { exerciseId: string }) => e.exerciseId);
      setStepResults((prev) => [
        ...prev,
        {
          stepId: current.id,
          type: "comprehension",
          score: body.result.score,
          mistakes: wrongIds,
          completedAt: new Date().toISOString(),
        },
      ]);
      setStepIndex((v) => v + 1);
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const wrongAnswers =
        lesson?.exercises
          ?.map((ex) => {
            const value = exerciseAnswers[ex.id] || "";
            const expected = String(ex.answer);
            const correct =
              value.trim().toLowerCase() === expected.trim().toLowerCase();
            return correct
              ? null
              : { userInput: value || "(blank)", expected };
          })
          .filter(Boolean) || [];

      const exerciseScore =
        lesson?.exercises?.length
          ? Math.round(
              (Object.entries(exerciseAnswers).filter(([id, value]) => {
                const ex = lesson.exercises?.find((e) => e.id === id);
                return (
                  ex &&
                  String(ex.answer).toLowerCase() === value.toLowerCase()
                );
              }).length /
                (lesson.exercises?.length || 1)) *
                100
            )
          : null;

      const hadComprehension = stepResults.some((r) => r.type === "comprehension");
      const stepScoreAvg = stepResults.length
        ? Math.round(
            stepResults.reduce((sum, r) => sum + r.score, 0) / stepResults.length
          )
        : null;
      const score = stepScoreAvg ?? exerciseScore ?? 85;

      const res = await fetch("/api/learning/lesson/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: params.lesson,
          score,
          minutes: lesson?.estimatedMinutes || 10,
          wrongAnswers,
          stepResults,
          skillScores: {
            vocabulary: score,
            reading: hadComprehension ? undefined : readingRef ? score : undefined,
            grammar: lesson?.grammar ? score : undefined,
          },
        }),
      });
      const data = await res.json();
      if (data.progression) setProgression(data.progression);
      if (data.assessment) setAssessment(data.assessment);
      if (data.remediationHint?.reason) {
        setRemediationHint(data.remediationHint.reason);
      }
      if (data.nextBest) setNextBest(data.nextBest);
      return data;
    },
    onSuccess: async () => {
      setFinished(true);
      await queryClient.invalidateQueries({ queryKey: ["daily-plan"] });
      await queryClient.invalidateQueries({ queryKey: ["progress"] });
    },
  });

  useEffect(() => {
    if (lesson && !startMutation.isSuccess && !startMutation.isPending) {
      startMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id]);

  function goNext() {
    if (current) {
      const stepScore =
        current.type === "exercise" && lesson?.exercises?.length
          ? Math.round(
              (Object.entries(exerciseAnswers).filter(([id, value]) => {
                const ex = lesson.exercises?.find((e) => e.id === id);
                return (
                  ex &&
                  String(ex.answer).toLowerCase() === value.toLowerCase()
                );
              }).length /
                (lesson.exercises?.length || 1)) *
                100
            )
          : 100;
      setStepResults((prev) => [
        ...prev,
        {
          stepId: current.id,
          type: current.type,
          score: stepScore,
          completedAt: new Date().toISOString(),
        },
      ]);
    }
    setStepIndex((v) => v + 1);
  }

  if (lessonQuery.isLoading) {
    return <p className="text-muted">Loading lesson...</p>;
  }

  if (
    isForbiddenError(lessonQuery.error) ||
    isForbiddenError(startMutation.error)
  ) {
    return <PremiumRequiredPanel title="This lesson is Premium" />;
  }

  if (!lesson) {
    return <p className="text-danger">Lesson not found.</p>;
  }

  if (!startMutation.isSuccess) {
    return (
      <p className="text-muted">
        {startMutation.isError ? "Could not start lesson." : "Preparing lesson..."}
      </p>
    );
  }

  if (finished) {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border border-line bg-surface p-8 text-center shadow-[var(--shadow-soft)] animate-rise">
        <Badge
          tone={
            assessment?.quality === "struggling"
              ? "warning"
              : assessment?.quality === "strong"
                ? "success"
                : "teal"
          }
        >
          {assessment?.quality === "struggling"
            ? "Completed with difficulty"
            : assessment?.quality === "strong"
              ? "Strong completion"
              : "Lesson complete"}
        </Badge>
        <h1 className="mt-4 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          {assessment?.quality === "struggling" ? "Keep going" : "Well done"}
        </h1>
        <p className="mt-3 text-muted">
          {assessment?.summary ||
            "Your learning profile and progress have been updated."}
        </p>
        {progression?.promoted ? (
          <div className="mt-4 rounded-2xl bg-teal-soft/50 px-4 py-3 text-sm">
            <p className="font-semibold text-teal-deep">
              Level up! {progression.previousLevel} → {progression.currentLevel}
            </p>
            <p className="mt-1 text-muted">
              New sub-level: {progression.subLevel?.toFixed(1)} · +100 XP bonus
            </p>
          </div>
        ) : progression?.blockers?.length ? (
          <p className="mt-4 text-sm text-muted">
            Level progress: {progression.blockers[0]}
          </p>
        ) : null}
        {remediationHint ? (
          <p className="mt-4 text-sm text-muted">{remediationHint}</p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {nextBest ? (
            <Button onClick={() => router.push(nextBest.href)}>
              Next: {nextBest.title}
            </Button>
          ) : (
            <Button onClick={() => router.push("/home")}>Continue on Home</Button>
          )}
          <Button variant="outline" onClick={() => router.push("/home")}>
            Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-rise">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="teal">{lesson.levelId}</Badge>
          <Badge>{current?.type}</Badge>
        </div>
        <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          {lesson.title}
        </h1>
        <p className="mt-2 text-muted">{lesson.description}</p>
        <div className="mt-4">
          <ProgressBar value={progress} />
          <p className="mt-2 text-xs text-muted">
            Step {Math.min(stepIndex + 1, steps.length)} of {steps.length}
          </p>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-[var(--shadow-soft)]">
        {current?.type === "introduction" && lesson.introduction ? (
          <div className="space-y-4">
            <h2 className="font-[family-name:var(--font-fraunces)] text-3xl text-ink">
              {lesson.introduction.headline}
            </h2>
            <p className="text-muted leading-relaxed">{lesson.introduction.body}</p>
            {lesson.introduction.bodyIt ? (
              <p className="text-sm text-muted/80">{lesson.introduction.bodyIt}</p>
            ) : null}
            <ul className="space-y-2">
              {lesson.introduction.objectives.map((obj) => (
                <li
                  key={obj}
                  className="rounded-xl bg-sand/70 px-4 py-3 text-sm font-medium text-ink"
                >
                  {obj}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {current?.type === "vocabulary" && lesson.vocabulary ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-ink">Key vocabulary</h2>
            <div className="grid gap-3">
              {lesson.vocabulary.map((item) => (
                <div
                  key={item.word}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-sand/40 px-4 py-3"
                >
                  <div>
                    <p className="text-lg font-semibold text-ink">{item.word}</p>
                    <p className="text-sm text-teal-deep">{item.translation}</p>
                    <p className="mt-1 text-sm text-muted">
                      {item.example} — {item.exampleTranslation}
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
          </div>
        ) : null}

        {current?.type === "reading" && passageQuery.data?.passage ? (
          <div className="relative space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold text-ink">
                {passageQuery.data.passage.title}
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    audio.setSpeed(0.75);
                    audio.speak(
                      passageQuery.data!.passage.sentences
                        .map((s) => s.text)
                        .join(" ")
                    );
                  }}
                >
                  Slow
                </Button>
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() => {
                    audio.setSpeed(1);
                    audio.speak(
                      passageQuery.data!.passage.sentences
                        .map((s) => s.text)
                        .join(" ")
                    );
                  }}
                >
                  Listen
                </Button>
              </div>
            </div>
            <InteractiveText
              sentences={passageQuery.data.passage.sentences}
              level={passageQuery.data.passage.level}
              sourceContentId={passageQuery.data.passage.id}
              expressionCatalog={(
                passageQuery.data as {
                  expressions?: Array<
                    Array<{
                      expression: import("@/types/expression").ExpressionDef;
                    }>
                  >;
                }
              ).expressions
                ?.flatMap((spans) => spans.map((s) => s.expression))
                .filter(
                  (e, i, arr) => arr.findIndex((x) => x.id === e.id) === i
                ) || []}
            />
          </div>
        ) : null}

        {current?.type === "comprehension" ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-ink">
              {current.title || "Check your understanding"}
            </h2>
            <p className="text-muted">
              Questions about “{passageQuery.data?.passage.title}”. Wrong answers
              go to Review.
            </p>
            {comprehensionExercises.length ? (
              <ExercisePlayer
                exercises={comprehensionExercises}
                onComplete={(attempts) => comprehensionMutation.mutate(attempts)}
              />
            ) : (
              <p className="text-muted">Loading comprehension...</p>
            )}
            {comprehensionMutation.isPending ? (
              <p className="text-sm text-muted">Saving results...</p>
            ) : null}
          </div>
        ) : null}

        {current?.type === "grammar" && lesson.grammar ? (
          <div className="space-y-5">
            <h2 className="text-2xl font-semibold text-ink">Grammar pattern</h2>
            <div className="space-y-2">
              {lesson.grammar.examples.map((ex) => (
                <p key={ex} className="reading-text text-ink">
                  {ex}
                </p>
              ))}
            </div>
            <div className="rounded-2xl bg-teal-soft px-4 py-3 font-semibold text-teal-deep">
              {lesson.grammar.pattern}
            </div>
            <p className="text-muted">{lesson.grammar.explanation}</p>
            {lesson.grammar.explanationIt ? (
              <p className="text-sm text-muted/80">{lesson.grammar.explanationIt}</p>
            ) : null}
          </div>
        ) : null}

        {current?.type === "exercise" && lesson.exercises ? (
          <div className="space-y-5">
            <h2 className="text-2xl font-semibold text-ink">Practice</h2>
            {lesson.exercises.map((ex) => (
              <div key={ex.id} className="rounded-2xl border border-line p-4">
                <p className="font-medium text-ink">{ex.prompt}</p>
                {ex.promptIt ? (
                  <p className="mt-1 text-sm text-muted">{ex.promptIt}</p>
                ) : null}
                {ex.type === "multiple_choice" && ex.options ? (
                  <div className="mt-3 space-y-2">
                    {ex.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() =>
                          setExerciseAnswers((prev) => ({
                            ...prev,
                            [ex.id]: option,
                          }))
                        }
                        className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm ${
                          exerciseAnswers[ex.id] === option
                            ? "border-teal bg-teal-soft"
                            : "border-line hover:border-teal/40"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    className="mt-3 h-11 w-full rounded-xl border border-line px-3 text-sm"
                    value={exerciseAnswers[ex.id] || ""}
                    onChange={(e) =>
                      setExerciseAnswers((prev) => ({
                        ...prev,
                        [ex.id]: e.target.value,
                      }))
                    }
                    placeholder="Type your answer"
                  />
                )}
              </div>
            ))}
          </div>
        ) : null}

        {current?.type === "review" && lesson.review ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-ink">Quick review</h2>
            <ul className="space-y-2">
              {lesson.review.summary.map((item) => (
                <li
                  key={item}
                  className="rounded-xl bg-sand/70 px-4 py-3 text-sm font-medium text-ink"
                >
                  {item}
                </li>
              ))}
            </ul>
            {lesson.review.tip ? (
              <p className="rounded-2xl border border-teal/20 bg-teal-soft/60 px-4 py-3 text-sm text-teal-deep">
                Tip: {lesson.review.tip}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex justify-between gap-3">
        <Button
          variant="outline"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((v) => Math.max(0, v - 1))}
        >
          Back
        </Button>
        {stepIndex + 1 >= steps.length ? (
          <Button
            size="lg"
            disabled={completeMutation.isPending}
            onClick={() => completeMutation.mutate()}
          >
            {completeMutation.isPending ? "Saving..." : "Complete lesson"}
          </Button>
        ) : current?.type === "comprehension" ? (
          <Button size="lg" disabled variant="outline">
            Answer the questions above
          </Button>
        ) : (
          <Button size="lg" onClick={goNext}>
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
