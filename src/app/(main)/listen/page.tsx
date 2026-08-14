"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { groupByCefrLevel } from "@/lib/groupByLevel";
import { PremiumLockedCard } from "@/components/subscription/PremiumRequiredPanel";
import type { ListeningContent } from "@/types/listening-grammar";

export default function ListenIndexPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["listening-list"],
    queryFn: async () => {
      const res = await fetch("/api/content/listening");
      return res.json() as Promise<{
        items: Array<ListeningContent & { locked?: boolean }>;
      }>;
    },
  });

  if (isLoading) return <p className="text-muted">Loading listening...</p>;

  const groups = groupByCefrLevel(data?.items || []);

  return (
    <div className="space-y-8 animate-rise">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
          Comprehension
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          Listen
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Graded audio practice from ZERO to C1 — choose, complete, order,
          dictation and comprehension, with speed control.
        </p>
      </div>

      {groups.map(({ level, items }) => (
        <section key={level} className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge tone="teal">{level}</Badge>
            <h2 className="font-[family-name:var(--font-fraunces)] text-xl text-ink">
              {items.length} session{items.length === 1 ? "" : "s"}
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
                <Link key={item.id} href={`/listen/${item.id}`}>
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
    </div>
  );
}
