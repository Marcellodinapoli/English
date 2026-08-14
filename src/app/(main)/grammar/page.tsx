"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { groupByCefrLevel } from "@/lib/groupByLevel";
import { PremiumLockedCard } from "@/components/subscription/PremiumRequiredPanel";
import type { GrammarTopic } from "@/types/listening-grammar";

export default function GrammarIndexPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["grammar-list"],
    queryFn: async () => {
      const res = await fetch("/api/content/grammar");
      return res.json() as Promise<{
        items: Array<GrammarTopic & { locked?: boolean }>;
      }>;
    },
  });

  if (isLoading) return <p className="text-muted">Loading grammar...</p>;

  const groups = groupByCefrLevel(data?.items || []);

  return (
    <div className="space-y-8 animate-rise">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
          Patterns in use
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          Grammar
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Example → Pattern → Explanation → Exercise → Real use. Organised by
          CEFR level and linked to your error engine.
        </p>
      </div>

      {groups.map(({ level, items }) => (
        <section key={level} className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge tone="teal">{level}</Badge>
            <h2 className="font-[family-name:var(--font-fraunces)] text-xl text-ink">
              {items.length} topic{items.length === 1 ? "" : "s"}
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item) =>
              item.locked ? (
                <PremiumLockedCard
                  key={item.id}
                  title={item.title}
                  description={item.pattern}
                  level={item.level}
                />
              ) : (
                <Link key={item.id} href={`/grammar/${item.id}`}>
                  <Card className="h-full transition hover:-translate-y-0.5 hover:border-teal/40">
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>{item.pattern}</CardDescription>
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
