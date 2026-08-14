"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { groupByCefrLevel } from "@/lib/groupByLevel";
import { PremiumLockedCard } from "@/components/subscription/PremiumRequiredPanel";
import type { PassageContent } from "@/types/content";

export default function ReadIndexPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["passages"],
    queryFn: async () => {
      const res = await fetch("/api/content/reading");
      return res.json() as Promise<{
        passages: Array<PassageContent & { locked?: boolean }>;
      }>;
    },
  });

  if (isLoading) return <p className="text-muted">Loading texts...</p>;

  const groups = groupByCefrLevel(data?.passages || []);

  return (
    <div className="space-y-8 animate-rise">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
          Graded reading
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          Read
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Interactive texts from ZERO to C1. Click any word for contextual
          meaning, pronunciation and vocabulary save.
        </p>
      </div>

      {groups.map(({ level, items }) => (
        <section key={level} className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge tone="teal">{level}</Badge>
            <h2 className="font-[family-name:var(--font-fraunces)] text-xl text-ink">
              {items.length} text{items.length === 1 ? "" : "s"}
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((passage) =>
              passage.locked ? (
                <PremiumLockedCard
                  key={passage.id}
                  title={passage.title}
                  description={passage.description || passage.titleIt}
                  level={passage.level}
                />
              ) : (
                <Link key={passage.id} href={`/read/${passage.id}`}>
                  <Card className="h-full transition hover:-translate-y-0.5 hover:border-teal/40">
                    <CardTitle>{passage.title}</CardTitle>
                    <CardDescription>
                      {passage.description || passage.titleIt}
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
