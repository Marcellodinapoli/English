"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useSession } from "@/hooks/useSession";
import { parseJsonArray } from "@/lib/clientJson";
import { isAdminUser } from "@/lib/clientAdmin";

export default function ProfilePage() {
  const router = useRouter();
  const { data } = useSession();
  const user = data?.user;

  const subscription = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await fetch("/api/subscription");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const focusSkills = parseJsonArray(user?.profile?.focusSkills);
  const sub = subscription.data?.subscription;
  const admin = user ? isAdminUser(user) : false;

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-rise">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
          Account
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          Profile
        </h1>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{user?.name}</CardTitle>
          {sub?.isPremium ? <Badge tone="teal">Premium</Badge> : <Badge>Free</Badge>}
          {admin ? <Badge tone="teal">Admin</Badge> : null}
        </div>
        <CardDescription>{user?.email}</CardDescription>
        <div className="mt-5 grid gap-3 text-sm">
          <div className="flex justify-between border-b border-line py-2">
            <span className="text-muted">Level</span>
            <span className="font-semibold">
              {user?.learningProfile?.currentLevel} ·{" "}
              {user?.learningProfile?.subLevel?.toFixed(1)}
            </span>
          </div>
          <div className="flex justify-between border-b border-line py-2">
            <span className="text-muted">Daily time</span>
            <span className="font-semibold">
              {user?.profile?.dailyMinutes || 15} min
            </span>
          </div>
          <div className="flex justify-between border-b border-line py-2">
            <span className="text-muted">Goal</span>
            <span className="max-w-[60%] text-right font-semibold">
              {user?.profile?.goal || "—"}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted">Focus</span>
            <span className="max-w-[60%] text-right font-semibold capitalize">
              {focusSkills.join(", ") || "—"}
            </span>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/achievements">
          <Card className="h-full transition hover:border-teal/40">
            <CardTitle className="text-base">Achievements</CardTitle>
            <CardDescription>Badges, milestones, bonus XP</CardDescription>
          </Card>
        </Link>
        <Link href="/subscription">
          <Card className="h-full transition hover:border-teal/40">
            <CardTitle className="text-base">Subscription</CardTitle>
            <CardDescription>
              {sub?.isPremium
                ? "Premium active"
                : "Upgrade for A2–C1 and unlimited sessions"}
            </CardDescription>
          </Card>
        </Link>
      </div>

      {admin ? (
        <Link href="/admin">
          <Button variant="soft" className="w-full">
            Open Admin CMS
          </Button>
        </Link>
      ) : null}

      <Button variant="outline" onClick={logout}>
        Log out
      </Button>
    </div>
  );
}
