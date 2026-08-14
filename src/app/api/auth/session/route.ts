import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAIOperational } from "@/services/ai/config";
import { subscriptionService } from "@/services/subscription/SubscriptionService";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null, aiOperational: isAIOperational() });
  }

  const subscription = await subscriptionService.getForUser(user.id);
  return NextResponse.json({
    user: {
      ...user,
      subscription,
    },
    aiOperational: isAIOperational(),
  });
}