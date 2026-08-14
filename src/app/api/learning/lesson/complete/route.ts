import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { adaptiveEngine } from "@/services/learning/AdaptiveEngine";
import { errorEngine } from "@/services/learning/ErrorEngine";
import { processGamification } from "@/lib/gamification";
import { recordUserActivity } from "@/lib/userActivity";
import { levelProgressionEngine } from "@/services/learning/LevelProgressionEngine";
import { reviewQueue } from "@/services/learning/ReviewQueueService";
import { lessonEngine } from "@/services/learning/LessonEngine";
import { contentService } from "@/services/content/ContentService";
import { dailyPlanService } from "@/services/learning/DailyPlanService";
import { gateCurriculumContent } from "@/lib/contentGate";

const schema = z.object({
  lessonId: z.string(),
  score: z.number().min(0).max(100).optional(),
  skillScores: z
    .object({
      vocabulary: z.number().optional(),
      grammar: z.number().optional(),
      reading: z.number().optional(),
      listening: z.number().optional(),
      speaking: z.number().optional(),
    })
    .optional(),
  minutes: z.number().optional(),
  wrongAnswers: z
    .array(
      z.object({
        userInput: z.string(),
        expected: z.string(),
      })
    )
    .optional(),
  stepResults: z
    .array(
      z.object({
        stepId: z.string(),
        type: z.string(),
        score: z.number(),
        mistakes: z.array(z.string()).optional(),
        completedAt: z.string(),
      })
    )
    .optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await request.json());
  const lesson = contentService.getLesson(body.lessonId);
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const gate = await gateCurriculumContent(lesson.levelId, {
    enforceProgression: true,
  });
  if (!gate.ok) return gate.response;

  const stepResults = body.stepResults ?? [];
  const comprehensionSteps = stepResults.filter((s) => s.type === "comprehension");
  const stepScoreAvg = stepResults.length
    ? Math.round(
        stepResults.reduce((sum, r) => sum + r.score, 0) / stepResults.length
      )
    : null;
  const score = stepScoreAvg ?? body.score ?? 80;
  const wrongCount =
    (body.wrongAnswers?.length ?? 0) +
    comprehensionSteps.reduce((sum, s) => sum + (s.mistakes?.length ?? 0), 0);
  const hasExercises =
    Boolean(lesson?.exercises?.length) || comprehensionSteps.length > 0;
  const assessment = lessonEngine.assessCompletion(score, {
    wrongCount,
    hasExercises,
  });

  await prisma.lessonProgress.update({
    where: {
      userId_lessonId: { userId: user.id, lessonId: body.lessonId },
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      score,
      outcome: assessment.quality,
      stepResults: body.stepResults
        ? JSON.stringify(body.stepResults)
        : undefined,
    },
  });

  if (body.wrongAnswers?.length) {
    for (const wrong of body.wrongAnswers) {
      const detected = errorEngine.analyze(
        wrong.userInput,
        wrong.expected,
        body.lessonId
      );
      for (const err of detected) {
        await reviewQueue.recordMistakeAndEnqueue({
          userId: user.id,
          errorType: err.errorType,
          skill: err.skill,
          userInput: err.userInput,
          correctForm: err.correctForm,
          context: body.lessonId,
          lessonId: body.lessonId,
          source: "lesson_complete",
          contentRef: body.lessonId,
          dueInMinutes: 30,
        });

        await analyticsService.track(user.id, "mistake_created", {
          errorType: err.errorType,
          lessonId: body.lessonId,
        });
      }
    }
  }

  const lp = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });

  // Weight mastery update by performance quality (struggling pulls more)
  const weight =
    assessment.quality === "struggling"
      ? 0.4
      : assessment.quality === "strong"
        ? 0.2
        : 0.3;

  if (lp && body.skillScores) {
    const skipReadingUpdate = comprehensionSteps.length > 0;
    await prisma.learningProfile.update({
      where: { userId: user.id },
      data: {
        vocabularyScore: body.skillScores.vocabulary
          ? adaptiveEngine.updateMastery(
              lp.vocabularyScore,
              body.skillScores.vocabulary / 100,
              weight
            )
          : lp.vocabularyScore,
        grammarScore: body.skillScores.grammar
          ? adaptiveEngine.updateMastery(
              lp.grammarScore,
              body.skillScores.grammar / 100,
              weight
            )
          : lp.grammarScore,
        readingScore:
          !skipReadingUpdate && body.skillScores.reading
            ? adaptiveEngine.updateMastery(
                lp.readingScore,
                body.skillScores.reading / 100,
                weight
              )
            : lp.readingScore,
        listeningScore: body.skillScores.listening
          ? adaptiveEngine.updateMastery(
              lp.listeningScore,
              body.skillScores.listening / 100,
              weight
            )
          : lp.listeningScore,
      },
    });
  }

  await prisma.userProgress.update({
    where: { userId: user.id },
    data: { lessonsCompleted: { increment: 1 } },
  });

  await recordUserActivity(user.id, {
    studyMinutes: body.minutes ?? 10,
    xp:
      assessment.quality === "strong"
        ? 50
        : assessment.quality === "struggling"
          ? 25
          : 40,
  });

  await analyticsService.track(user.id, "lesson_completed", {
    lessonId: body.lessonId,
    score,
    quality: assessment.quality,
    needsRemediation: assessment.needsRemediation,
  });

  const progression = await levelProgressionEngine.evaluate(user.id);
  const gamification = await processGamification(user.id);

  // Fresh plan after lesson — same-day adaptation
  const nextPlan = await dailyPlanService.build(
    user.id,
    user.profile?.dailyMinutes || 15
  );

  const remediation =
    assessment.remediation ||
    (assessment.needsRemediation
      ? {
          href: nextPlan.recommended.href,
          reason: nextPlan.recommended.reason,
          kind: nextPlan.recommended.kind || "practice",
        }
      : undefined);

  return NextResponse.json({
    ok: true,
    gamification,
    progression,
    assessment,
    // Informational only — primary next step is always nextBest from Daily Plan.
    remediationHint: remediation
      ? { reason: remediation.reason, kind: remediation.kind }
      : undefined,
    nextBest: nextPlan.recommended,
  });
}
