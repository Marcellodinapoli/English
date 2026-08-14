"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import type { SubscriptionDTO } from "@/types/gamification";

export default function SubscriptionPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await fetch("/api/subscription");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ subscription: SubscriptionDTO }>;
    },
  });

  const upgrade = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/subscription/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 30 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upgrade failed");
      return json.subscription as SubscriptionDTO;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
    },
  });

  if (isLoading) return <p className="text-muted">Loading plan…</p>;

  const sub = data?.subscription;

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-rise">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
          Membership
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          Subscription
        </h1>
        <p className="mt-2 text-muted">
          Free covers the ZERO–A1 curriculum path. Premium unlocks A2–C1 content,
          unlimited tutor and role play sessions, and advanced analytics.
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={sub?.isPremium ? "teal" : undefined}>
            {sub?.plan || "FREE"}
          </Badge>
          <Badge>{sub?.status || "ACTIVE"}</Badge>
        </div>
        <CardTitle className="mt-3">
          {sub?.isPremium ? "Premium active" : "Free plan"}
        </CardTitle>
        <CardDescription>
          {sub?.expiresAt
            ? `Renews / expires: ${new Date(sub.expiresAt).toLocaleDateString()}`
            : "No expiration on free plan."}
        </CardDescription>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Free</CardTitle>
          <CardDescription className="mt-2">Core learning path</CardDescription>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>Curriculum ZERO → A1</li>
            <li>Daily plan & review</li>
            <li>3 tutor sessions / day</li>
            <li>2 role play sessions / day</li>
          </ul>
        </Card>

        <Card className="border-teal/30 bg-teal-soft/20">
          <CardTitle>Premium</CardTitle>
          <CardDescription className="mt-2">Full Alinea experience</CardDescription>
          <ul className="mt-4 space-y-2 text-sm">
            {(sub?.features || []).map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                {feature}
              </li>
            ))}
          </ul>
          {!sub?.isPremium ? (
            <Button
              className="mt-6 w-full"
              onClick={() => upgrade.mutate()}
              disabled={upgrade.isPending}
            >
              {upgrade.isPending ? "Activating…" : "Upgrade (dev stub — 30 days)"}
            </Button>
          ) : null}
          {upgrade.error ? (
            <p className="mt-2 text-sm text-red-600">{upgrade.error.message}</p>
          ) : null}
          <p className="mt-3 text-xs text-muted">
            Production: connect App Store / Google Play billing webhooks.
          </p>
        </Card>
      </div>

      <Link href="/profile" className="text-sm font-medium text-teal hover:underline">
        ← Back to profile
      </Link>
    </div>
  );
}
