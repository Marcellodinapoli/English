import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { analyticsInsightsService } from "@/services/analytics/AnalyticsInsightsService";
import { subscriptionService } from "@/services/subscription/SubscriptionService";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await subscriptionService.getForUser(user.id);
  if (!sub.isPremium) {
    return NextResponse.json(
      {
        error: "Advanced analytics require Premium.",
        upgradeHref: "/subscription",
      },
      { status: 403 }
    );
  }

  const insights = await analyticsInsightsService.getInsights(user.id);
  return NextResponse.json({ insights });
}
