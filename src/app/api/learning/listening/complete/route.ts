import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contentService } from "@/services/content/ContentService";
import { exerciseEngine } from "@/services/learning/ExerciseEngine";
import { adaptiveEngine } from "@/services/learning/AdaptiveEngine";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { errorEngine } from "@/services/learning/ErrorEngine";
import { processGamification } from "@/lib/gamification";
import { recordUserActivity } from "@/lib/userActivity";
import { reviewQueue } from "@/services/learning/ReviewQueueService";
import { gateCurriculumContent } from "@/lib/contentGate";

const schema = z.object({
  listeningId: z.string(),
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
  const listening = contentService.getListening(body.listeningId);
  if (!listening) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const gate = await gateCurriculumContent(listening.level);
  if (!gate.ok) return gate.response;

  const exercises = listening.items.map((item) => ({
    id: item.id,
    type:
      item.type === "listen_complete" || item.type === "dictation"
        ? ("fill_blank" as const)
        : item.type === "listen_order"
          ? ("reorder" as const)
          : ("multiple_choice" as const),
    prompt: item.prompt,
    options: item.options,
    answer: item.answer,
    explanation: item.explanation,
  }));

  const result = exerciseEngine.evaluateSession(exercises, body.attempts);

  for (const evaluation of result.evaluations) {
    if (!evaluation.correct) {
      const input = Array.isArray(evaluation.userAnswer)
        ? evaluation.userAnswer.join(" ")
        : evaluation.userAnswer;
      const expected = Array.isArray(evaluation.expected)
        ? evaluation.expected.join(" ")
        : evaluation.expected;
      const detected = errorEngine.analyze(input, expected, listening.title);
      for (const err of detected) {
        await reviewQueue.recordMistakeAndEnqueue({
          userId: user.id,
          errorType: err.errorType,
          skill: "listening",
          userInput: err.userInput,
          correctForm: err.correctForm,
          context: listening.id,
          source: "listening_complete",
          contentRef: listening.id,
          level: listening.level,
        });
      }
    }
  }

  const lp = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  if (lp) {
    await prisma.learningProfile.update({
      where: { userId: user.id },
      data: {
        listeningScore: adaptiveEngine.updateMastery(
          lp.listeningScore,
          result.score / 100
        ),
      },
    });
  }

  await recordUserActivity(user.id, {
    studyMinutes: listening.estimatedMinutes,
    xp: Math.max(10, Math.round(result.score / 5)),
  });

  await analyticsService.track(user.id, "exercise_completed", {
    type: "listening",
    listeningId: listening.id,
    score: result.score,
  });

  const gamification = await processGamification(user.id);

  return NextResponse.json({ result, gamification });
}