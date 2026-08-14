"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";

type Question = {
  id: string;
  skill: string;
  prompt: string;
  options: string[];
  answer: string;
};

export default function AssessmentPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["assessment"],
    queryFn: async () => {
      const res = await fetch("/api/content/assessment");
      return res.json() as Promise<{ questions: Question[] }>;
    },
  });

  const questions = data?.questions || [];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<
    Array<{ questionId: string; skill: string; correct: boolean }>
  >([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    level: string;
    subLevel: number;
  } | null>(null);

  const current = questions[index];
  const progress = useMemo(
    () => (questions.length ? ((index + (selected ? 1 : 0)) / questions.length) * 100 : 0),
    [index, questions.length, selected]
  );

  async function next() {
    if (!current || !selected) return;
    const nextAnswers = [
      ...answers,
      {
        questionId: current.id,
        skill: current.skill,
        correct: selected === current.answer,
      },
    ];
    setAnswers(nextAnswers);
    setSelected(null);

    if (index + 1 >= questions.length) {
      setSubmitting(true);
      const res = await fetch("/api/user/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: nextAnswers }),
      });
      const body = await res.json();
      setSubmitting(false);
      setResult({ level: body.level, subLevel: body.subLevel });
      return;
    }
    setIndex((v) => v + 1);
  }

  if (isLoading) {
    return <p className="text-muted">Preparing your assessment...</p>;
  }

  if (result) {
    return (
      <div className="animate-rise rounded-[2rem] border border-line bg-surface p-8 shadow-[var(--shadow-soft)]">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
          Your starting level
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-5xl text-ink">
          {result.level}
          <span className="ml-2 text-2xl text-muted">
            · {result.subLevel.toFixed(1)}
          </span>
        </h1>
        <p className="mt-4 text-muted">
          Your personal path is ready. Alinea will adapt every day based on your
          strengths and weaknesses.
        </p>
        <Button className="mt-8" size="lg" onClick={() => router.push("/home")}>
          Go to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-rise">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
        Assessment · {current?.skill}
      </p>
      <div className="mt-4">
        <ProgressBar value={progress} />
      </div>
      <h1 className="mt-6 font-[family-name:var(--font-fraunces)] text-3xl text-ink md:text-4xl">
        {current?.prompt}
      </h1>
      <div className="mt-6 space-y-3">
        {current?.options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setSelected(option)}
            className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
              selected === option
                ? "border-teal bg-teal-soft"
                : "border-line bg-surface hover:border-teal/40"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <Button
        className="mt-8"
        size="lg"
        disabled={!selected || submitting}
        onClick={next}
      >
        {submitting
          ? "Building your path..."
          : index + 1 >= questions.length
            ? "Finish assessment"
            : "Next"}
      </Button>
    </div>
  );
}