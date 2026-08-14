import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, parseJsonArray, toJsonArray } from "@/lib/auth";
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
  grammarId: z.string(),
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
  const topic = contentService.getGrammar(body.grammarId);
  if (!topic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const gate = await gateCurriculumContent(topic.level);
  if (!gate.ok) return gate.response;

  const result = exerciseEngine.evaluateSession(topic.exercises, body.attempts);

  for (const evaluation of result.evaluations) {
    if (!evaluation.correct) {
      const input = String(evaluation.userAnswer);
      const expected = String(evaluation.expected);
      const detected = errorEngine.analyze(input, expected, topic.title);
      for (const err of detected) {
        await reviewQueue.recordMistakeAndEnqueue({
          userId: user.id,
          errorType: err.errorType,
          skill: "grammar",
          userInput: err.userInput,
          correctForm: err.correctForm,
          context: topic.id,
          source: "grammar_complete",
          contentRef: topic.id,
          level: topic.level,
        });
      }
    }
  }

  const lp = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  if (lp) {
    const acquired = new Set(parseJsonArray(lp.acquiredGrammarTopics));
    const problematic = new Set(parseJsonArray(lp.problematicGrammarTopics));
    if (result.score >= 80) {
      acquired.add(topic.id);
      problematic.delete(topic.id);
    } else {
      problematic.add(topic.id);
    }

    await prisma.learningProfile.update({
      where: { userId: user.id },
      data: {
        grammarScore: adaptiveEngine.updateMastery(
          lp.grammarScore,
          result.score / 100
        ),
        acquiredGrammarTopics: toJsonArray([...acquired]),
        problematicGrammarTopics: toJsonArray([...problematic]),
      },
    });
  }

  await recordUserActivity(user.id, {
    studyMinutes: 8,
    xp: Math.max(10, Math.round(result.score / 5)),
  });

  await analyticsService.track(user.id, "exercise_completed", {
    type: "grammar",
    grammarId: topic.id,
    score: result.score,
  });

  const gamification = await processGamification(user.id);

  return NextResponse.json({ result, gamification });
}