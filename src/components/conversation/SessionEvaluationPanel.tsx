"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import type { ConversationEvaluation } from "@/types/conversation";

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-semibold text-ink">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sand">
        <div
          className="h-full rounded-full bg-teal transition-all"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

export function SessionEvaluationPanel({
  evaluation,
  onRestart,
  restartHref,
  nextHref = "/home",
  masteryApplied,
}: {
  evaluation: ConversationEvaluation;
  onRestart?: () => void;
  restartHref?: string;
  nextHref?: string;
  masteryApplied?: boolean;
}) {
  const offline = evaluation.source !== "ai";

  return (
    <Card className="animate-rise space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="teal">Session complete</Badge>
        <Badge>{offline ? "Offline analysis" : "AI analysis"}</Badge>
        {offline ? (
          <Badge>
            {masteryApplied === false
              ? "Mastery not boosted"
              : masteryApplied
                ? "Mastery updated from errors"
                : "Session recorded"}
          </Badge>
        ) : null}
      </div>
      <CardTitle className="text-3xl">{evaluation.overall}/100</CardTitle>
      <CardDescription>{evaluation.feedback}</CardDescription>
      {offline && masteryApplied === false ? (
        <p className="text-sm text-muted">
          Offline scores are informative. Without reliable error signals they do
          not raise CEFR mastery — continue with Review or your Daily Plan.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <ScoreBar label="Grammar" value={evaluation.grammar} />
        <ScoreBar label="Vocabulary" value={evaluation.vocabulary} />
        <ScoreBar label="Fluency" value={evaluation.fluency} />
      </div>

      {evaluation.grammarErrors.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-ink">Grammar notes</h3>
          <ul className="mt-2 space-y-2">
            {evaluation.grammarErrors.map((err, i) => (
              <li
                key={i}
                className="rounded-[var(--radius-md)] bg-sand/70 px-3 py-2 text-sm"
              >
                <span className="line-through text-muted">{err.original}</span>
                {" → "}
                <span className="font-medium text-teal-deep">{err.correction}</span>
                <p className="mt-1 text-xs text-muted">{err.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {evaluation.recommendations.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-ink">Next steps</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {evaluation.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {evaluation.reviewTopics.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {evaluation.reviewTopics.map((topic) => (
            <Badge key={topic}>{topic}</Badge>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link href={nextHref}>
          <Button>
            {nextHref.startsWith("/review") ? "Open Review" : "Continue on Home"}
          </Button>
        </Link>
        {onRestart ? (
          <Button variant="soft" onClick={onRestart}>
            Try again
          </Button>
        ) : restartHref ? (
          <Link href={restartHref}>
            <Button variant="soft">Try again</Button>
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
