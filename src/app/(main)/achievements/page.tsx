"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AchievementBadge } from "@/components/gamification/AchievementBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { AchievementDefinition, MilestoneProgressDTO } from "@/types/gamification";

export default function AchievementsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const res = await fetch("/api/achievements");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{
        achievements: Array<{
          achievement: AchievementDefinition;
          unlocked: boolean;
          unlockedAt: string | null;
        }>;
        milestones: MilestoneProgressDTO[];
        summary: { unlocked: number; total: number; xp: number; streak: number };
      }>;
    },
  });

  if (isLoading) return <p className="text-muted">Loading achievements…</p>;

  return (
    <div className="space-y-8 animate-rise">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
          Gamification
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          Achievements
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Unlock badges as you learn. Each achievement grants bonus XP.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardDescription>Unlocked</CardDescription>
          <CardTitle className="mt-1 text-3xl">
            {data?.summary.unlocked || 0}/{data?.summary.total || 0}
          </CardTitle>
        </Card>
        <Card>
          <CardDescription>Total XP</CardDescription>
          <CardTitle className="mt-1 text-3xl">{data?.summary.xp || 0}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Streak</CardDescription>
          <CardTitle className="mt-1 text-3xl">
            {data?.summary.streak || 0} days
          </CardTitle>
        </Card>
      </div>

      <section>
        <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">
          Milestones
        </h2>
        <div className="mt-4 space-y-3">
          {(data?.milestones || []).map(({ milestone, reached, progress, target }) => (
            <Card key={milestone.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{milestone.titleIt}</CardTitle>
                  <CardDescription>{milestone.description}</CardDescription>
                </div>
                <Badge tone={reached ? "teal" : undefined}>
                  {reached ? "Reached" : "In progress"}
                </Badge>
              </div>
              {!reached ? (
                <div className="mt-3">
                  <ProgressBar value={(progress / target) * 100} />
                  <p className="mt-1 text-xs text-muted">
                    {progress} / {target}
                  </p>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">
          Badges
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.achievements || []).map(({ achievement, unlocked }) => (
            <AchievementBadge
              key={achievement.id}
              achievement={achievement}
              unlocked={unlocked}
            />
          ))}
        </div>
      </section>

      <Link href="/progress" className="text-sm font-medium text-teal hover:underline">
        ← Back to progress
      </Link>
    </div>
  );
}
