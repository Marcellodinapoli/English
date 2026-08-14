import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiService } from "@/services/ai/AIService";
import { adaptiveEngine } from "@/services/learning/AdaptiveEngine";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { errorEngine } from "@/services/learning/ErrorEngine";
import { processGamification } from "@/lib/gamification";
import { recordUserActivity } from "@/lib/userActivity";
import { reviewQueue } from "@/services/learning/ReviewQueueService";
import { isPremiumRequiredForLevel } from "@/lib/contentAccess";
import { gateCurriculumContent } from "@/lib/contentGate";

const schema = z.object({
  text: z.string().min(1),
  prompt: z.string().min(1),
  level: z.string().optional(),
  writingId: z.string().optional(),
  itemId: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await request.json());
  if (body.level && isPremiumRequiredForLevel(body.level)) {
    const gate = await gateCurriculumContent(body.level);
    if (!gate.ok) return gate.response;
  }

  const evaluation = await aiService.evaluateWriting(
    {
      text: body.text,
      prompt: body.prompt,
      level: body.level,
    },
    { userId: user.id }
  );

  const contentRef =
    body.writingId && body.itemId
      ? `${body.writingId}:${body.itemId}`
      : body.writingId || body.prompt;

  const structured = errorEngine.analyzeStructured(
    evaluation.mistakes.map((m) => ({
      original: m.original,
      correction: m.correction,
      type: m.type,
      topic: m.topic,
      skill: m.skill,
      context: body.prompt,
    })),
    body.prompt
  );

  for (const err of structured) {
    await reviewQueue.recordMistakeAndEnqueue({
      userId: user.id,
      errorType: err.errorType,
      skill: err.skill,
      userInput: err.userInput,
      correctForm: err.correctForm,
      context: body.prompt,
      source: "evaluate_writing",
      contentRef,
      level: body.level,
      metadata: {
        topic: err.topic,
        sourceType: err.sourceType,
        aiSource: evaluation.source,
        recommendation: err.recommendation,
        writingId: body.writingId,
        itemId: body.itemId,
      },
    });

    await analyticsService.track(user.id, "mistake_created", {
      errorType: err.errorType,
      topic: err.topic,
      source: "evaluate_writing",
    });
  }

  const lp = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  if (lp) {
    await prisma.learningProfile.update({
      where: { userId: user.id },
      data: {
        writingScore: adaptiveEngine.updateMastery(
          lp.writingScore,
          evaluation.overall / 100
        ),
        grammarScore: adaptiveEngine.updateMastery(
          lp.grammarScore,
          evaluation.grammar / 100
        ),
        vocabularyScore: adaptiveEngine.updateMastery(
          lp.vocabularyScore,
          evaluation.vocabulary / 100
        ),
      },
    });
  }

  await recordUserActivity(user.id, {
    studyMinutes: 3,
    xp: Math.max(8, Math.round(evaluation.overall / 8)),
  });

  await analyticsService.track(user.id, "exercise_completed", {
    type: "writing",
    overall: evaluation.overall,
    source: evaluation.source,
    mistakeCount: structured.length,
  });

  const gamification = await processGamification(user.id);

  return NextResponse.json({ evaluation, gamification });
}
