import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { toLearningProfileDTO } from "@/lib/learningProfile";
import { prisma } from "@/lib/prisma";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { contentService } from "@/services/content/ContentService";
import { gateCurriculumContent } from "@/lib/contentGate";
import { lessonEngine } from "@/services/learning/LessonEngine";

const startSchema = z.object({
  lessonId: z.string(),
  unitId: z.string(),
  levelId: z.string(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = startSchema.parse(await request.json());

  const gate = await gateCurriculumContent(body.levelId, {
    enforceProgression: true,
  });
  if (!gate.ok) return gate.response;

  const lesson = contentService.getLesson(body.lessonId);
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const profile = user.learningProfile
    ? toLearningProfileDTO(user.learningProfile)
    : null;
  const session = lessonEngine.buildSession(lesson, profile);

  const progress = await prisma.lessonProgress.upsert({
    where: {
      userId_lessonId: { userId: user.id, lessonId: body.lessonId },
    },
    create: {
      userId: user.id,
      lessonId: body.lessonId,
      unitId: body.unitId,
      levelId: body.levelId,
      status: "IN_PROGRESS",
      startedAt: new Date(),
      currentStep: 0,
    },
    update: {
      status: "IN_PROGRESS",
      startedAt: new Date(),
    },
  });

  await analyticsService.track(user.id, "lesson_started", {
    lessonId: body.lessonId,
  });

  return NextResponse.json({ progress, steps: session.steps });
}