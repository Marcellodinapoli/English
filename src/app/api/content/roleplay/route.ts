import { NextResponse } from "next/server";
import {
  FREE_MAX_CONTENT_LEVEL,
  isPremiumRequiredForLevel,
} from "@/lib/contentAccess";
import { getViewerAccess } from "@/lib/contentGate";
import { contentService } from "@/services/content/ContentService";
import { subscriptionService } from "@/services/subscription/SubscriptionService";

/**
 * Roleplay catalog: quota-only gate (unchanged). UX metadata for Free ceiling
 * and remaining sessions — does not redact or block A2+ scenarios.
 */
export async function GET() {
  const { user, isPremium } = await getViewerAccess();
  const items = contentService.listRoleplay().map((item) => ({
    ...item,
    aboveFreeCurriculum:
      !isPremium && isPremiumRequiredForLevel(item.level),
  }));

  let roleplayQuota: {
    allowed: boolean;
    remaining: number | null;
    reason?: string;
  } = { allowed: true, remaining: null };

  if (user) {
    const gate = await subscriptionService.canStartConversation(
      user.id,
      "roleplay"
    );
    roleplayQuota = {
      allowed: gate.allowed,
      remaining: gate.remaining ?? (isPremium ? null : 0),
      reason: gate.reason,
    };
  }

  return NextResponse.json({
    items,
    freeCurriculumMax: FREE_MAX_CONTENT_LEVEL,
    isPremium,
    roleplayQuota,
  });
}
