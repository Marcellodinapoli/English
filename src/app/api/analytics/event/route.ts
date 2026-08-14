import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import type { AnalyticsEventName } from "@/services/analytics/AnalyticsService";

const schema = z.object({
  event: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await request.json());
  await analyticsService.track(
    user.id,
    body.event as AnalyticsEventName,
    body.metadata
  );
  return NextResponse.json({ ok: true });
}