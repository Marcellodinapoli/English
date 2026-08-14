"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { SkillBar } from "@/components/ui/ProgressBar";

export default function ProgressPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["progress"],
    queryFn: async () => {
      const res = await fetch("/api/progress");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) return <p className="text-muted">Loading progress...</p>;

  const scores = data?.scores || {};
  const weekly = data?.analytics?.weeklyActivity || [];
  const isPremium = Boolean(data?.subscription?.isPremium);
  const freeCap = data?.freeCurriculum;

  return (
    <div className="space-y-8 animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
            Dashboard
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
            Progress
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href="/achievements">
            <Button variant="soft">Achievements</Button>
          </Link>
          {!isPremium ? (
            <Link href="/subscription">
              <Button variant="outline">Go Premium</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Level", `${data?.level} · ${Number(data?.subLevel || 0).toFixed(1)}`],
          ["XP", String(data?.progress?.xp || 0)],
          ["Streak", `${data?.progress?.streak || 0} days`],
          ["Badges", `${data?.achievements?.unlocked || 0}/${data?.achievements?.total || 0}`],
        ].map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
          </Card>
        ))}
      </div>

      {freeCap?.atCap && !isPremium ? (
        <Card className="border-teal/30 bg-teal-soft/20">
          <CardTitle className="text-base">
            Free content limit: {freeCap.maxContentLevel}
          </CardTitle>
          <CardDescription className="mt-2">
            {freeCap.levelBeyondContent
              ? `Profile level ${data?.level} can keep rising, but Free curriculum content stays on ZERO–${freeCap.maxContentLevel}. Unlock A2–C1 with Premium.`
              : `Lessons and catalog content on Free stop at ${freeCap.maxContentLevel}. Upgrade for A2–C1.`}
          </CardDescription>
          <Link href="/subscription" className="mt-4 inline-block">
            <Button variant="soft" size="sm">
              Go Premium
            </Button>
          </Link>
        </Card>
      ) : null}

      {isPremium ? (
        <Card>
          <CardTitle>Activity this week</CardTitle>
          <CardDescription>
            {data?.analytics?.studyMinutesThisWeek || 0} min estimated · avg{" "}
            {data?.analytics?.averageDailyMinutes || 0} min/day
          </CardDescription>
          <div className="mt-5 flex items-end gap-2">
            {weekly.map(
              (day: { date: string; count: number; minutes: number }) => {
                const max = Math.max(
                  ...weekly.map((d: { count: number }) => d.count),
                  1
                );
                const height = Math.max(12, (day.count / max) * 96);
                return (
                  <div
                    key={day.date}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <div
                      className="w-full max-w-10 rounded-t-lg bg-teal/80 transition-all"
                      style={{ height }}
                      title={`${day.count} events`}
                    />
                    <span className="text-[10px] text-muted">
                      {day.date.slice(5)}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardTitle>Activity this week</CardTitle>
          <CardDescription className="mt-2">
            Weekly activity charts are part of Premium analytics.
          </CardDescription>
          <Link href="/subscription" className="mt-4 inline-block">
            <Button variant="outline" size="sm">
              Unlock insights
            </Button>
          </Link>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardTitle>Skills</CardTitle>
          <CardDescription>Mastery scores from your learning profile.</CardDescription>
          <div className="mt-5 space-y-4">
            {Object.entries(scores).map(([label, value]) => (
              <SkillBar
                key={label}
                label={label}
                value={typeof value === "number" ? value : 0}
              />
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>Milestones</CardTitle>
            <div className="mt-3 space-y-2">
              {(data?.milestones || []).slice(0, 4).map(
                (m: {
                  milestone: { titleIt: string };
                  reached: boolean;
                }) => (
                  <div
                    key={m.milestone.titleIt}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{m.milestone.titleIt}</span>
                    <Badge tone={m.reached ? "teal" : undefined}>
                      {m.reached ? "✓" : "…"}
                    </Badge>
                  </div>
                )
              )}
            </div>
            <Link href="/achievements" className="mt-4 inline-block text-sm text-teal">
              View all →
            </Link>
          </Card>

          <Card>
            <CardTitle>Weakest skill</CardTitle>
            <div className="mt-3">
              <Badge tone="warning" className="capitalize">
                {data?.weakest || "listening"}
              </Badge>
            </div>
            <CardDescription className="mt-3">
              Same priority as your Daily Plan on Home.
            </CardDescription>
          </Card>

          <Card>
            <CardTitle>Review queue</CardTitle>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {data?.dueReviewCount || 0}
            </p>
            <CardDescription>
              Due now · open mistakes: {data?.openMistakes || 0}
            </CardDescription>
            <Link href="/review" className="mt-4 inline-block">
              <Button variant="soft">Open review</Button>
            </Link>
          </Card>

          <Card>
            <CardTitle>Recommended next</CardTitle>
            <CardDescription>
              {data?.recommended?.title || "Continue learning"}
              {data?.recommended?.minutes
                ? ` · ${data.recommended.minutes} min`
                : ""}
            </CardDescription>
            {data?.recommended?.reason || data?.planGoalHint ? (
              <p className="mt-2 text-sm text-muted">
                {data?.recommended?.reason || data?.planGoalHint}
              </p>
            ) : null}
            <Link
              href={data?.recommended?.href || "/home"}
              className="mt-4 inline-block"
            >
              <Button>Start activity</Button>
            </Link>
          </Card>

          {isPremium && data?.analytics?.eventBreakdown ? (
            <Card>
              <CardTitle>Premium insights</CardTitle>
              <ul className="mt-3 space-y-1 text-sm text-muted">
                {data.analytics.eventBreakdown.slice(0, 5).map(
                  (row: { event: string; count: number }) => (
                    <li key={row.event} className="flex justify-between">
                      <span className="capitalize">
                        {row.event.replace(/_/g, " ")}
                      </span>
                      <span className="font-medium text-ink">{row.count}</span>
                    </li>
                  )
                )}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
