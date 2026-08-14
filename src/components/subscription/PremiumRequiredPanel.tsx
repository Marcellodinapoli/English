"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PREMIUM_UPGRADE_HREF } from "@/lib/contentAccess";

export function PremiumRequiredPanel({
  title = "Premium content",
  description = "This activity is part of A2–C1. Upgrade to continue from the level you have already reached.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-xl animate-rise rounded-[2rem] border border-line bg-surface p-8 text-center shadow-[var(--shadow-soft)]">
      <Badge>Premium</Badge>
      <div className="mx-auto mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-sand text-muted">
        <Lock className="h-5 w-5" />
      </div>
      <h1 className="mt-4 font-[family-name:var(--font-fraunces)] text-3xl text-ink">
        {title}
      </h1>
      <p className="mt-3 text-muted">{description}</p>
      <Link href={PREMIUM_UPGRADE_HREF} className="mt-8 inline-block">
        <Button>Upgrade to Premium</Button>
      </Link>
    </div>
  );
}

export function PremiumLockedCard({
  title,
  description,
  level,
}: {
  title: string;
  description?: string;
  level?: string;
}) {
  return (
    <Card className="h-full border-dashed opacity-90">
      <div className="flex flex-wrap items-center gap-2">
        {level ? <Badge>{level}</Badge> : null}
        <Badge>Premium</Badge>
      </div>
      <CardTitle className="mt-3">{title}</CardTitle>
      {description ? (
        <CardDescription className="mt-1">{description}</CardDescription>
      ) : null}
      <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-muted">
        <Lock className="h-3.5 w-3.5" />
        Locked — upgrade to open
      </p>
      <Link
        href={PREMIUM_UPGRADE_HREF}
        className="mt-4 inline-block text-sm font-semibold text-teal hover:underline"
      >
        Go Premium
      </Link>
    </Card>
  );
}

export function isForbiddenError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: number }).status === 403
  );
}

export async function fetchCurriculumJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 401 || res.status === 403) {
    const body = (await res.json().catch(() => ({}))) as {
      upgradeHref?: string;
    };
    const err = new Error("premium_required") as Error & {
      status: number;
      upgradeHref?: string;
    };
    err.status = 403;
    err.upgradeHref = body.upgradeHref;
    throw err;
  }
  if (!res.ok) throw new Error("Not found");
  return res.json() as Promise<T>;
}
