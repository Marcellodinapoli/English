"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { canAccessLevel } from "@/lib/cefr";
import { isPremiumRequiredForLevel } from "@/lib/contentAccess";
import { LEVEL_PROGRESSION_THRESHOLDS } from "@/lib/levelProgressionThresholds";
import { useSession } from "@/hooks/useSession";
import type { LevelMeta } from "@/types/content";

export default function LearnPage() {
  const session = useSession();
  const userLevel = session.data?.user?.learningProfile?.currentLevel || "ZERO";

  const { data, isLoading } = useQuery({
    queryKey: ["levels"],
    queryFn: async () => {
      const res = await fetch("/api/content/levels");
      return res.json() as Promise<{ levels: LevelMeta[] }>;
    },
  });

  const progressQuery = useQuery({
    queryKey: ["level-progress"],
    queryFn: async () => {
      const res = await fetch("/api/learning/level-progress");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) return <p className="text-muted">Loading curriculum...</p>;

  return (
    <div className="space-y-8 animate-rise">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
          Curriculum
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          Learn
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Full path ZERO → C1. Complete every lesson at your current level and
          reach {LEVEL_PROGRESSION_THRESHOLDS.masteryMin}+ average mastery in core
          skills to unlock the next level. Free includes ZERO and A1; A2–C1
          require Premium.
        </p>
        {progressQuery.data ? (
          <Card className="mt-4 border-teal/20 bg-teal-soft/20">
            <CardTitle className="text-base">
              Your level: {progressQuery.data.currentLevel} ·{" "}
              {Number(progressQuery.data.subLevel).toFixed(1)}
            </CardTitle>
            <CardDescription>
              {progressQuery.data.lessonsCompletedInLevel}/
              {progressQuery.data.lessonsTotalInLevel} lessons ·{" "}
              {progressQuery.data.levelProgressPercent}% of level complete
              {progressQuery.data.nextLevel
                ? ` · Next: ${progressQuery.data.nextLevel}`
                : " · Maximum level reached"}
              {progressQuery.data.nextLevel &&
              isPremiumRequiredForLevel(progressQuery.data.nextLevel) &&
              !session.data?.user?.subscription?.isPremium
                ? " (Premium required for A2–C1 content)"
                : ""}
            </CardDescription>
            {!session.data?.user?.subscription?.isPremium &&
            isPremiumRequiredForLevel(progressQuery.data.currentLevel) ? (
              <p className="mt-3 text-sm text-muted">
                Your profile can sit above A1, but Free curriculum content stays
                on ZERO–A1.{" "}
                <Link
                  href="/subscription"
                  className="font-semibold text-teal hover:underline"
                >
                  Upgrade to open A2+
                </Link>
              </p>
            ) : null}
          </Card>
        ) : null}
      </div>

      <div className="space-y-6">
        {(data?.levels || []).map((level) => {
          const progressionUnlocked = canAccessLevel(userLevel, level.id);
          const premiumLocked =
            isPremiumRequiredForLevel(level.id) &&
            !session.data?.user?.subscription?.isPremium;
          const unlocked = progressionUnlocked && !premiumLocked;
          return (
            <Card
              key={level.id}
              className={`overflow-hidden p-0 ${unlocked ? "" : "opacity-75"}`}
            >
              <div className="border-b border-line bg-[linear-gradient(90deg,rgba(15,110,106,0.08),transparent)] px-6 py-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={unlocked ? "teal" : undefined}>{level.name}</Badge>
                  <h2 className="text-xl font-semibold text-ink">{level.label}</h2>
                  {!unlocked ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                      <Lock className="h-3.5 w-3.5" />
                      {premiumLocked ? "Premium" : "Locked"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-muted">{level.description}</p>
                {premiumLocked ? (
                  <Link
                    href="/subscription"
                    className="mt-3 inline-block text-sm font-semibold text-teal hover:underline"
                  >
                    Upgrade to unlock {level.name}
                  </Link>
                ) : null}
              </div>
              <div className="space-y-5 px-6 py-5">
                {level.units.map((unit) => (
                  <div key={unit.id}>
                    <h3 className="font-semibold text-ink">
                      Unit {unit.order} — {unit.title}
                    </h3>
                    <p className="text-sm text-muted">{unit.description}</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {unit.lessons.map((lesson) =>
                        unlocked ? (
                          <Link
                            key={lesson.id}
                            href={`/learn/${level.id}/${unit.id}/${lesson.id}`}
                            className="rounded-2xl border border-line bg-sand/30 px-4 py-3 transition hover:border-teal/40 hover:bg-teal-soft/30"
                          >
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                              Lesson {lesson.order}
                            </p>
                            <p className="mt-1 font-semibold text-ink">
                              {lesson.title}
                            </p>
                          </Link>
                        ) : (
                          <div
                            key={lesson.id}
                            className="rounded-2xl border border-dashed border-line bg-sand/20 px-4 py-3 text-muted"
                          >
                            <p className="text-xs font-semibold uppercase tracking-wide">
                              Lesson {lesson.order}
                            </p>
                            <p className="mt-1 font-semibold">{lesson.title}</p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
