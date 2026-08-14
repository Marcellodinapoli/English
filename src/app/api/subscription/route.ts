import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { subscriptionService } from "@/services/subscription/SubscriptionService";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await subscriptionService.getForUser(user.id);
  return NextResponse.json({ subscription });
}
