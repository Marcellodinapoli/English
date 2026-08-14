"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Flame, Target } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/hooks/useSession";

export default function HomePage() {
  const session = useSession();
  const planQuery = useQuery({
    queryKey: ["daily-plan"],
    queryFn: async () => {
      const res = await fetch("/api/learning/daily-plan");
      if (!res.ok) throw new Error("Failed to load plan");
      return res.json();
    },
    refetchOnWindowFocus: true,
  });

  const plan = planQuery.data;
  const nextBest = plan?.nextBest || plan?.recommendedLesson;
  const planItems = plan?.plan || [];
  const freeCap = plan?.freeCurriculum;
  const showFreeCapBanner =
    freeCap?.atCap && !plan?.subscription?.isPremium;

  if (session.isLoading || planQuery.isLoading) {
    return <p className="text-muted">Preparing today&apos;s path...</p>;
  }

  return (
    <div className="space-y-8 animate-rise">
      <section className="relative overflow-hidden rounded-[2rem] border border-line bg-[linear-gradient(135deg,#132033_0%,#1d3a45_48%,#0f6e6a_130%)] p-7 text-white shadow-[var(--shadow-lift)]">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/60">
          Best next step
        </p>
        <h1 className="mt-3 max-w-xl font-[family-name:var(--font-fraunces)] text-4xl leading-tight md:text-5xl">
          {nextBest?.title || "Continue learning"}
        </h1>
        <p className="mt-3 max-w-xl text-white/70">
          {nextBest?.reason ||
            plan?.goalHint ||
            (plan?.goal ? `Goal: ${plan.goal}` : "Your adaptive path is ready.")}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Badge className="bg-white/10 text-white">
            {plan?.profile?.currentLevel || "ZERO"} ·{" "}
            {plan?.profile?.subLevel?.toFixed?.(1) || "0.1"}
          </Badge>
          <Badge className="bg-white/10 text-white">
            <Flame className="mr-1 h-3.5 w-3.5" />
            {plan?.progress?.streak || 0} day streak
          </Badge>
          {plan?.dueReviewCount ? (
            <Badge className="bg-white/10 text-white">
              {plan.dueReviewCount} review due
            </Badge>
          ) : null}
        </div>
        <div className="mt-8">
          <Link href={nextBest?.href || "/learn"}>
            <Button size="xl" className="bg-white text-ink hover:bg-sand">
              Start now
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {showFreeCapBanner ? (
        <Card className="border-teal/30 bg-teal-soft/25">
          <CardTitle className="text-base">
            Free curriculum ends at {freeCap.maxContentLevel}
          </CardTitle>
          <CardDescription className="mt-2">
            {freeCap.levelBeyondContent
              ? `Your profile is at ${plan?.level}, but Free lessons stay on ZERO–${freeCap.maxContentLevel}. Upgrade to open A2–C1 content.`
              : `You can finish ZERO–${freeCap.maxContentLevel} on Free. A2–C1 lessons require Premium.`}
          </CardDescription>
          <Link href="/subscription" className="mt-4 inline-block">
            <Button variant="soft" size="sm">
              See Premium
            </Button>
          </Link>
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Today</CardTitle>
              <CardDescription>
                Recalculated from your reviews, errors and mastery — not random.
              </CardDescription>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {planItems.slice(0, 4).map(
              (
                item: {
                  id: string;
                  title: string;
                  minutes: number;
                  reason: string;
                  href: string;
                  kind?: string;
                },
                index: number
              ) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center justify-between rounded-2xl border border-line bg-sand/40 px-4 py-3 transition hover:border-teal/40 hover:bg-teal-soft/40"
                >
                  <div>
                    <p className="font-semibold text-ink">
                      {index + 1}. {item.title}
                    </p>
                    <p className="text-sm text-muted">{item.reason}</p>
                  </div>
                  <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-teal-deep">
                    {item.minutes} min
                  </span>
                </Link>
              )
            )}
            {!planItems.length ? (
              <p className="text-sm text-muted">No activities yet — start a lesson.</p>
            ) : null}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-teal" />
              <CardTitle className="text-base">Main weakness</CardTitle>
            </div>
            <CardDescription className="mt-2 capitalize">
              {plan?.weakest || "—"}
            </CardDescription>
            {plan?.goal ? (
              <p className="mt-4 text-sm text-muted">Goal: {plan.goal}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/practice">
                <Button variant="soft" size="sm">
                  Practice
                </Button>
              </Link>
              <Link href="/review">
                <Button variant="outline" size="sm">
                  Review
                </Button>
              </Link>
            </div>
          </Card>

          <Card>
            <CardTitle className="text-base">Today&apos;s progress</CardTitle>
            <CardDescription>
              {plan?.progress?.totalStudyMinutes
                ? `${plan.progress.totalStudyMinutes} min studied · ${plan.progress.xp || 0} XP`
                : "Complete an activity to update your path."}
            </CardDescription>
          </Card>
        </div>
      </section>
    </div>
  );
}
