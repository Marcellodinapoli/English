"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { groupByCefrLevel } from "@/lib/groupByLevel";
import { PremiumLockedCard } from "@/components/subscription/PremiumRequiredPanel";
import type { SpeakingContent, WritingContent } from "@/types/speaking";

export default function SpeakIndexPage() {
  const speaking = useQuery({
    queryKey: ["speaking-list"],
    queryFn: async () => {
      const res = await fetch("/api/content/speaking");
      return res.json() as Promise<{
        items: Array<SpeakingContent & { locked?: boolean }>;
      }>;
    },
  });
  const writing = useQuery({
    queryKey: ["writing-list"],
    queryFn: async () => {
      const res = await fetch("/api/content/writing");
      return res.json() as Promise<{
        items: Array<WritingContent & { locked?: boolean }>;
      }>;
    },
  });

  if (speaking.isLoading) return <p className="text-muted">Loading speaking...</p>;

  const speakGroups = groupByCefrLevel(speaking.data?.items || []);
  const writeGroups = groupByCefrLevel(writing.data?.items || []);

  return (
    <div className="space-y-8 animate-rise">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
          Production skills
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          Speak
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Record real answers across ZERO → C1. Offline mode scores speaking
          (accuracy, fluency, vocabulary, grammar). Pronunciation is scored only
          when pronunciation assessment is enabled.
        </p>
      </div>

      {speakGroups.map(({ level, items }) => (
        <section key={level} className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge tone="teal">{level}</Badge>
            <h2 className="font-[family-name:var(--font-fraunces)] text-xl text-ink">
              Speaking
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item) =>
              item.locked ? (
                <PremiumLockedCard
                  key={item.id}
                  title={item.title}
                  description={item.description || item.titleIt}
                  level={item.level}
                />
              ) : (
                <Link key={item.id} href={`/speak/${item.id}`}>
                  <Card className="h-full transition hover:-translate-y-0.5 hover:border-teal/40">
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>
                      {item.description || item.titleIt} · {item.estimatedMinutes}{" "}
                      min
                    </CardDescription>
                  </Card>
                </Link>
              )
            )}
          </div>
        </section>
      ))}

      <div>
        <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">
          Writing practice
        </h2>
        <p className="mt-1 text-sm text-muted">
          Short prompts with grammar and vocabulary feedback.
        </p>
        {writeGroups.map(({ level, items }) => (
          <section key={level} className="mt-4 space-y-3">
            <Badge tone="teal">{level}</Badge>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((item) =>
                item.locked ? (
                  <PremiumLockedCard
                    key={item.id}
                    title={item.title}
                    description={item.description}
                    level={item.level}
                  />
                ) : (
                  <Card key={item.id}>
                    <CardTitle className="mt-1">{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                    <Link
                      href={`/speak/write/${item.id}`}
                      className="mt-4 inline-block"
                    >
                      <Button variant="soft">Start writing</Button>
                    </Link>
                  </Card>
                )
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
