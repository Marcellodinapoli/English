import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reviewQueue } from "@/services/learning/ReviewQueueService";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { items, upcomingCount } = await reviewQueue.listDue(user.id, 20);

  return NextResponse.json({
    dueCount: items.length,
    upcomingCount,
    items,
  });
}
