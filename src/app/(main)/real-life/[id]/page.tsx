"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import { ConversationSession } from "@/components/conversation/ConversationSession";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import type { RoleplayScenario } from "@/types/conversation";

type RoleplayListItem = RoleplayScenario & {
  aboveFreeCurriculum?: boolean;
};

export default function RoleplaySessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, isLoading, error } = useQuery({
    queryKey: ["roleplay", id],
    queryFn: async () => {
      const res = await fetch("/api/content/roleplay");
      const json = (await res.json()) as {
        items: RoleplayListItem[];
        isPremium?: boolean;
        freeCurriculumMax?: string;
        roleplayQuota?: {
          allowed: boolean;
          remaining: number | null;
          reason?: string;
        };
      };
      const scenario = json.items.find((s) => s.id === id);
      if (!scenario) throw new Error("Scenario not found");
      return { scenario, meta: json };
    },
  });

  if (isLoading) {
    return <p className="text-muted">Loading scenario…</p>;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">Scenario not found.</p>
        <Link href="/real-life">
          <Button variant="soft">Back to Real life</Button>
        </Link>
      </div>
    );
  }

  const { scenario, meta } = data;
  const quota = meta.roleplayQuota;
  const quotaBlocked = quota && !meta.isPremium && !quota.allowed;

  return (
    <div className="space-y-8 animate-rise">
      <div>
        <Link
          href="/real-life"
          className="text-sm font-medium text-teal hover:underline"
        >
          ← Real life
        </Link>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="teal">{scenario.level}</Badge>
          <Badge>{scenario.category}</Badge>
          {scenario.aboveFreeCurriculum ? (
            <Badge>Above Free curriculum</Badge>
          ) : null}
        </div>
        <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          {scenario.title}
        </h1>
        <p className="mt-2 max-w-2xl text-muted">{scenario.descriptionIt}</p>
      </div>

      {scenario.aboveFreeCurriculum && !meta.isPremium ? (
        <Card className="border-dashed">
          <CardTitle className="text-base">Practice note</CardTitle>
          <CardDescription className="mt-2">
            Free curriculum lessons stop at {meta.freeCurriculumMax || "A1"}.
            This scenario is still available as speaking practice and uses your
            Free daily role play quota.{" "}
            <Link href="/subscription" className="font-semibold text-teal">
              Premium unlocks A2–C1 curriculum
            </Link>
            .
          </CardDescription>
        </Card>
      ) : null}

      {quotaBlocked ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardTitle className="text-base">Session limit reached</CardTitle>
          <CardDescription className="mt-2">
            {quota?.reason ||
              "You have used today’s Free role play sessions."}
          </CardDescription>
          <Link href="/subscription" className="mt-4 inline-block">
            <Button variant="soft">Upgrade to Premium</Button>
          </Link>
          <Link href="/real-life" className="mt-3 ml-3 inline-block">
            <Button variant="outline">Back to list</Button>
          </Link>
        </Card>
      ) : null}

      <Card>
        <CardTitle className="text-lg">Scene</CardTitle>
        <CardDescription className="mt-2">{scenario.setting}</CardDescription>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="font-semibold text-ink">You:</span>{" "}
            {scenario.yourRole}
          </p>
          <p>
            <span className="font-semibold text-ink">Partner:</span>{" "}
            {scenario.aiRole}
          </p>
        </div>
        {!meta.isPremium && quota?.remaining != null && quota.allowed ? (
          <p className="mt-4 text-sm text-muted">
            {quota.remaining} Free session{quota.remaining === 1 ? "" : "s"} left
            today.
          </p>
        ) : null}
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
          {scenario.goals.map((goal) => (
            <li key={goal}>{goal}</li>
          ))}
        </ul>
      </Card>

      {!quotaBlocked ? (
        <ConversationSession
          type="roleplay"
          scenarioId={scenario.id}
          scenarioTitle={scenario.title}
          suggestedPhrases={scenario.suggestedPhrases}
        />
      ) : null}
    </div>
  );
}
