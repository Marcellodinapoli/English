"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Square } from "lucide-react";
import { useState } from "react";
import { ConversationChat } from "@/components/conversation/ConversationChat";
import { SessionEvaluationPanel } from "@/components/conversation/SessionEvaluationPanel";
import { Button } from "@/components/ui/Button";
import { invalidateLearningQueries } from "@/lib/invalidateLearning";
import type {
  ConversationEvaluation,
  ConversationMessage,
} from "@/types/conversation";

export function ConversationSession({
  type,
  scenarioId,
  scenarioTitle,
  suggestedPhrases,
}: {
  type: "tutor" | "roleplay";
  scenarioId?: string;
  scenarioTitle?: string;
  suggestedPhrases?: string[];
}) {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [canComplete, setCanComplete] = useState(false);
  const [evaluation, setEvaluation] = useState<ConversationEvaluation | null>(
    null
  );
  const [masteryApplied, setMasteryApplied] = useState<boolean | undefined>();
  const [nextHref, setNextHref] = useState("/home");
  const [error, setError] = useState<string | null>(null);
  const [upgradeHref, setUpgradeHref] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/conversations/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, scenarioId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.upgradeHref) setUpgradeHref(data.upgradeHref);
        throw new Error(data.error || "Could not start session");
      }
      return data as {
        sessionId: string;
        messages: ConversationMessage[];
      };
    },
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setMessages(data.messages);
      setEvaluation(null);
      setCanComplete(false);
      setError(null);
      setUpgradeHref(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const send = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/conversations/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send message");
      return data as {
        messages: ConversationMessage[];
        canComplete: boolean;
      };
    },
    onSuccess: (data) => {
      setMessages(data.messages);
      setCanComplete(data.canComplete);
      setInput("");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const complete = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/conversations/${sessionId}/complete`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not complete session");
      return data as {
        evaluation: ConversationEvaluation;
        masteryApplied?: boolean;
        nextHref?: string;
      };
    },
    onSuccess: async (data) => {
      setEvaluation(data.evaluation);
      setMasteryApplied(data.masteryApplied);
      setNextHref(data.nextHref || "/home");
      setError(null);
      await invalidateLearningQueries(queryClient);
    },
    onError: (err: Error) => setError(err.message),
  });

  const busy = start.isPending || send.isPending || complete.isPending;

  function handleStart() {
    start.mutate();
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !sessionId || busy) return;
    send.mutate(text);
  }

  function handleRestart() {
    setSessionId(null);
    setMessages([]);
    setEvaluation(null);
    setCanComplete(false);
    setMasteryApplied(undefined);
    start.mutate();
  }

  if (evaluation) {
    return (
      <SessionEvaluationPanel
        evaluation={evaluation}
        onRestart={handleRestart}
        nextHref={nextHref}
        masteryApplied={masteryApplied}
      />
    );
  }

  if (!sessionId) {
    return (
      <div className="space-y-4">
        {scenarioTitle ? (
          <p className="text-sm text-muted">
            Scenario: <span className="font-medium text-ink">{scenarioTitle}</span>
          </p>
        ) : null}
        <Button size="lg" onClick={handleStart} disabled={start.isPending}>
          {start.isPending ? "Starting…" : "Start conversation"}
        </Button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {upgradeHref ? (
          <Link href={upgradeHref}>
            <Button variant="soft">Upgrade to Premium</Button>
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ConversationChat messages={messages} loading={send.isPending} />

      {suggestedPhrases && suggestedPhrases.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {suggestedPhrases.map((phrase) => (
            <button
              key={phrase}
              type="button"
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted transition hover:border-teal/40 hover:text-ink"
              onClick={() => setInput(phrase)}
              disabled={busy}
            >
              {phrase}
            </button>
          ))}
        </div>
      ) : null}

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type in English…"
          className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-teal/50"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !input.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={() => complete.mutate()}
          disabled={!canComplete || busy}
        >
          <Square className="h-4 w-4" />
          {complete.isPending ? "Analyzing…" : "Finish & get feedback"}
        </Button>
        {!canComplete ? (
          <p className="text-xs text-muted">
            Send a few messages before finishing.
          </p>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
