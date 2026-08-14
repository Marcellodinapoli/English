"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { ConversationMessage } from "@/types/conversation";

export function ConversationChat({
  messages,
  loading,
  emptyLabel = "Start the conversation…",
}: {
  messages: ConversationMessage[];
  loading?: boolean;
  emptyLabel?: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!messages.length) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-dashed border-line bg-sand/40 px-4 py-8 text-center text-sm text-muted">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="flex max-h-[min(52vh,520px)] flex-col gap-3 overflow-y-auto rounded-[var(--radius-lg)] border border-line bg-surface p-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            "max-w-[88%] animate-rise",
            msg.role === "user" ? "ml-auto" : "mr-auto"
          )}
        >
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-sm leading-relaxed",
              msg.role === "user"
                ? "rounded-br-md bg-teal text-white"
                : "rounded-bl-md bg-sand text-ink"
            )}
          >
            {msg.content}
          </div>
          {msg.hint && msg.role === "assistant" ? (
            <p className="mt-1 px-1 text-xs text-muted">{msg.hint}</p>
          ) : null}
        </div>
      ))}
      {loading ? (
        <p className="text-sm text-muted animate-pulse">Thinking…</p>
      ) : null}
      <div ref={bottomRef} />
    </div>
  );
}
