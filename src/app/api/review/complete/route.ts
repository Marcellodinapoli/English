import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import type { ReviewGrade } from "@/services/learning/SpacedRepetition";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { processGamification } from "@/lib/gamification";
import { recordUserActivity } from "@/lib/userActivity";
import { reviewQueue } from "@/services/learning/ReviewQueueService";

const schema = z.object({
  reviewId: z.string(),
  grade: z.number().min(0).max(5),
  userAnswer: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await request.json());
  const updated = await reviewQueue.complete(
    user.id,
    body.reviewId,
    body.grade as ReviewGrade
  );
  if (!updated) {
    return NextResponse.json({ error: "Review item not found" }, { status: 404 });
  }

  await recordUserActivity(user.id, {
    studyMinutes: 1,
    xp: body.grade >= 3 ? 8 : 2,
  });

  await analyticsService.track(user.id, "word_reviewed", {
    reviewId: updated.id,
    itemType: updated.itemType,
    grade: body.grade,
  });

  const gamification = await processGamification(user.id);

  return NextResponse.json({ item: updated, gamification });
}
