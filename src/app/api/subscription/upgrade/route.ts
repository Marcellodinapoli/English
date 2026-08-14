import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription/SubscriptionService";
import { analyticsService } from "@/services/analytics/AnalyticsService";

const schema = z.object({
  days: z.number().min(1).max(365).optional(),
});

/**
 * Local/dev upgrade stub. Production should use App Store / Play Billing webhooks.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await request.json().catch(() => ({})));
  const subscription = await subscriptionService.upgradeToPremium(
    user.id,
    body.days ?? 30
  );

  await analyticsService.track(user.id, "subscription_upgraded", {
    plan: subscription.plan,
    provider: "local",
  });

  return NextResponse.json({ subscription });
}
