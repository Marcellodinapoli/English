"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import type { RoleplayCategory, RoleplayScenario } from "@/types/conversation";

const CATEGORY_LABELS: Record<
  RoleplayCategory,
  { label: string; description: string }
> = {
  travel: {
    label: "Travel",
    description: "Hotels, transport, and trips abroad.",
  },
  work: {
    label: "Work",
    description: "Meetings, colleagues, and first days.",
  },
  daily: {
    label: "Daily life",
    description: "Shops, cafés, and everyday errands.",
  },
  social: {
    label: "Social",
    description: "Friends, plans, and small talk.",
  },
};

type RoleplayListItem = RoleplayScenario & {
  aboveFreeCurriculum?: boolean;
};

export default function RealLifePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["roleplay-list"],
    queryFn: async () => {
      const res = await fetch("/api/content/roleplay");
      return res.json() as Promise<{
        items: RoleplayListItem[];
        freeCurriculumMax?: string;
        isPremium?: boolean;
        roleplayQuota?: {
          allowed: boolean;
          remaining: number | null;
          reason?: string;
        };
      }>;
    },
  });

  if (isLoading) {
    return <p className="text-muted">Loading scenarios…</p>;
  }

  const items = data?.items || [];
  const categories = Object.keys(CATEGORY_LABELS) as RoleplayCategory[];
  const quota = data?.roleplayQuota;
  const isPremium = Boolean(data?.isPremium);

  return (
    <div className="space-y-8 animate-rise">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
          Real life
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          Role play
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Practice real situations — travel, work, daily life, and social
          settings. You talk with a character partner; after the session you get
          scores, errors, and next steps (offline analysis unless cloud AI is
          enabled).
        </p>
      </div>

      {!isPremium ? (
        <Card className="border-teal/20 bg-teal-soft/15">
          <CardTitle className="text-base">Free plan sessions</CardTitle>
          <CardDescription className="mt-2">
            {quota && quota.remaining != null
              ? quota.allowed
                ? `${quota.remaining} role play session${quota.remaining === 1 ? "" : "s"} left today.`
                : quota.reason || "Daily Free role play limit reached."
              : "Free includes a daily role play quota."}{" "}
            Curriculum Free content is ZERO–{data?.freeCurriculumMax || "A1"};
            higher-level scenarios are practice-only and still use your daily
            quota.
          </CardDescription>
          {!quota?.allowed ? (
            <Link href="/subscription" className="mt-4 inline-block">
              <Button variant="soft" size="sm">
                Upgrade for unlimited sessions
              </Button>
            </Link>
          ) : null}
        </Card>
      ) : null}

      {categories.map((category) => {
        const group = items.filter((s) => s.category === category);
        if (!group.length) return null;
        const meta = CATEGORY_LABELS[category];

        return (
          <section key={category} className="space-y-4">
            <div>
              <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">
                {meta.label}
              </h2>
              <p className="text-sm text-muted">{meta.description}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {group.map((item) => (
                <Link key={item.id} href={`/real-life/${item.id}`}>
                  <Card className="h-full transition hover:-translate-y-0.5 hover:border-teal/40">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="teal">{item.level}</Badge>
                      {item.aboveFreeCurriculum ? (
                        <Badge>Above Free curriculum</Badge>
                      ) : null}
                    </div>
                    <CardTitle className="mt-3">{item.title}</CardTitle>
                    <CardDescription>
                      {item.descriptionIt} · {item.estimatedMinutes} min
                      {item.aboveFreeCurriculum
                        ? " · Counts toward Free daily quota"
                        : ""}
                    </CardDescription>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
