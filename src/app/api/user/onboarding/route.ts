import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, toJsonArray } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyticsService } from "@/services/analytics/AnalyticsService";

const schema = z.object({
  name: z.string().min(2).optional(),
  perceivedLevel: z.string(),
  goal: z.string().min(2),
  motivation: z.string().min(2),
  dailyMinutes: z.number().min(5).max(120),
  frequency: z.string(),
  focusSkills: z.array(z.string()),
  priorKnowledge: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await request.json());

  if (body.name) {
    await prisma.user.update({
      where: { id: user.id },
      data: { name: body.name },
    });
  }

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      perceivedLevel: body.perceivedLevel,
      goal: body.goal,
      motivation: body.motivation,
      dailyMinutes: body.dailyMinutes,
      frequency: body.frequency,
      focusSkills: toJsonArray(body.focusSkills),
      priorKnowledge: body.priorKnowledge,
      onboardingDone: false,
    },
    update: {
      perceivedLevel: body.perceivedLevel,
      goal: body.goal,
      motivation: body.motivation,
      dailyMinutes: body.dailyMinutes,
      frequency: body.frequency,
      focusSkills: toJsonArray(body.focusSkills),
      priorKnowledge: body.priorKnowledge,
    },
  });

  await analyticsService.track(user.id, "onboarding_completed", {
    perceivedLevel: body.perceivedLevel,
  });

  return NextResponse.json({ ok: true });
}