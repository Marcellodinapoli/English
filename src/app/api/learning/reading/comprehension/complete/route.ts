import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contentService } from "@/services/content/ContentService";
import { exerciseEngine } from "@/services/learning/ExerciseEngine";
import { adaptiveEngine } from "@/services/learning/AdaptiveEngine";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { reviewQueue } from "@/services/learning/ReviewQueueService";
import { comprehensionToExercise } from "@/lib/comprehension";
import { processGamification } from "@/lib/gamification";
import { recordUserActivity } from "@/lib/userActivity";
import { expressionService } from "@/services/content/ExpressionService";
import { gateCurriculumContent } from "@/lib/contentGate";

const schema = z.object({
  passageId: z.string(),
  lessonId: z.string().optional(),
  durationMs: z.number().optional(),
  attempts: z.array(
    z.object({
      exerciseId: z.string(),
      userAnswer: z.union([z.string(), z.array(z.string())]),
    })
  ),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await request.json());
  const set = contentService.getComprehension(body.passageId);
  const passage = contentService.getPassage(body.passageId);
  if (!set || !passage) {
    return NextResponse.json(
      { error: "Comprehension not found for passage" },
      { status: 404 }
    );
  }

  const gate = await gateCurriculumContent(passage.level);
  if (!gate.ok) return gate.response;

  const exercises = set.questions.map(comprehensionToExercise);
  const result = exerciseEngine.evaluateSession(exercises, body.attempts);
  const wrongCount = result.total - result.correctCount;
  const accuracy = result.score / 100;

  for (const evaluation of result.evaluations) {
    if (evaluation.correct) continue;
    const question = set.questions.find((q) => q.id === evaluation.exerciseId);
    const input = Array.isArray(evaluation.userAnswer)
      ? evaluation.userAnswer.join(" ")
      : String(evaluation.userAnswer || "");
    const expected = Array.isArray(evaluation.expected)
      ? evaluation.expected.join(" ")
      : String(evaluation.expected);

    const skill = question?.skill || "reading";
    await reviewQueue.recordMistakeAndEnqueue({
      userId: user.id,
      errorType: question?.topic || question?.type || "reading_comprehension",
      skill,
      userInput: input || "(blank)",
      correctForm: expected,
      context: question?.question || body.passageId,
      lessonId: body.lessonId,
      level: question?.level || passage.level,
      source: "reading_comprehension",
      contentRef: body.passageId,
      metadata: {
        passageId: body.passageId,
        questionId: evaluation.exerciseId,
        questionType: question?.type,
        vocabularyFocus: passage.vocabularyFocus || [],
        relatedExpressionId:
          expressionService.findBySurface(expected)?.id || null,
      },
    });
  }

  const attempt = await prisma.readingComprehensionAttempt.create({
    data: {
      userId: user.id,
      passageId: body.passageId,
      lessonId: body.lessonId,
      totalQuestions: result.total,
      correctCount: result.correctCount,
      wrongCount,
      accuracy,
      durationMs: body.durationMs,
      results: JSON.stringify(result.evaluations),
    },
  });

  const lp = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  let readingScore = lp?.readingScore;
  if (lp) {
    readingScore = adaptiveEngine.updateMastery(lp.readingScore, accuracy);
    await prisma.learningProfile.update({
      where: { userId: user.id },
      data: { readingScore },
    });
  }

  await recordUserActivity(user.id, {
    studyMinutes: Math.max(3, Math.round((body.durationMs || 180000) / 60000)),
    // Embedded in a lesson: lesson/complete awards XP — avoid double credit.
    xp: body.lessonId ? 0 : Math.max(10, Math.round(result.score / 5)),
  });

  await analyticsService.track(user.id, "exercise_completed", {
    type: "reading_comprehension",
    passageId: body.passageId,
    score: result.score,
    accuracy,
    embeddedInLesson: Boolean(body.lessonId),
  });

  const gamification = body.lessonId
    ? { newlyUnlocked: [] as Awaited<
        ReturnType<typeof processGamification>
      >["newlyUnlocked"], xpGranted: 0 }
    : await processGamification(user.id);

  return NextResponse.json({
    result,
    attempt,
    readingScore,
    gamification,
  });
}
