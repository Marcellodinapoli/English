"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ExerciseItem } from "@/types/content";
import { cn } from "@/lib/utils";

export function ExercisePlayer({
  exercises,
  onComplete,
}: {
  exercises: ExerciseItem[];
  onComplete: (
    attempts: Array<{ exerciseId: string; userAnswer: string | string[] }>
  ) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [orderPicks, setOrderPicks] = useState<Record<string, string[]>>({});

  function setAnswer(id: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function toggleOrder(id: string, option: string, all: string[]) {
    setOrderPicks((prev) => {
      const current = prev[id] || [];
      let next: string[];
      if (current.includes(option)) {
        next = current.filter((x) => x !== option);
      } else if (current.length < all.length) {
        next = [...current, option];
      } else {
        next = current;
      }
      setAnswer(id, next);
      return { ...prev, [id]: next };
    });
  }

  return (
    <div className="space-y-5">
      {exercises.map((ex, index) => (
        <div key={ex.id} className="rounded-2xl border border-line p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Exercise {index + 1}
          </p>
          <p className="mt-2 font-medium text-ink">{ex.prompt}</p>
          {ex.promptIt ? (
            <p className="mt-1 text-sm text-muted">{ex.promptIt}</p>
          ) : null}

          {ex.type === "multiple_choice" && ex.options ? (
            <div className="mt-3 space-y-2">
              {ex.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAnswer(ex.id, option)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2.5 text-left text-sm transition",
                    answers[ex.id] === option
                      ? "border-teal bg-teal-soft"
                      : "border-line hover:border-teal/40"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}

          {ex.type === "fill_blank" ? (
            <input
              className="mt-3 h-11 w-full rounded-xl border border-line px-3 text-sm"
              value={(answers[ex.id] as string) || ""}
              onChange={(e) => setAnswer(ex.id, e.target.value)}
              placeholder="Type your answer"
            />
          ) : null}

          {ex.type === "match" && ex.options ? (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-muted">
                Tap the meanings in the order of the numbered words.
              </p>
              <div className="flex flex-wrap gap-2">
                {ex.options.map((option) => {
                  const picked = (orderPicks[ex.id] || []).includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleOrder(ex.id, option, ex.options || [])}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-sm font-medium",
                        picked
                          ? "bg-teal text-white"
                          : "bg-sand text-ink hover:bg-teal-soft"
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-muted">
                Order: {(orderPicks[ex.id] || []).join(" → ") || "—"}
              </p>
            </div>
          ) : null}

          {ex.type === "reorder" && ex.options ? (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                {ex.options.map((option) => {
                  const picked = (orderPicks[ex.id] || []).includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleOrder(ex.id, option, ex.options || [])}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-sm font-medium",
                        picked
                          ? "bg-teal text-white"
                          : "bg-sand text-ink hover:bg-teal-soft"
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-muted">
                Order: {(orderPicks[ex.id] || []).join(" ") || "—"}
              </p>
            </div>
          ) : null}
        </div>
      ))}

      <Button
        size="lg"
        className="w-full"
        onClick={() =>
          onComplete(
            exercises.map((ex) => ({
              exerciseId: ex.id,
              userAnswer: answers[ex.id] ?? "",
            }))
          )
        }
      >
        Check answers
      </Button>
    </div>
  );
}