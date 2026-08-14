import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, parseJsonArray, toJsonArray } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorEngine } from "@/services/learning/ErrorEngine";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { contentService } from "@/services/content/ContentService";
import { reviewQueue } from "@/services/learning/ReviewQueueService";

const schema = z.object({
  userInput: z.string().min(1),
  expected: z.string().optional(),
  context: z.string().optional(),
  skill: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await request.json());
  const detected = errorEngine.analyze(body.userInput, body.expected, body.context);
  const saved = [];

  for (const err of detected) {
    const { mistake } = await reviewQueue.recordMistakeAndEnqueue({
      userId: user.id,
      errorType: err.errorType,
      skill: body.skill || err.skill,
      userInput: err.userInput,
      correctForm: err.correctForm,
      context: err.context || body.context,
      source: "mistakes_api",
      dueInMinutes: 4 * 60,
      enqueueGrammarTopic: true,
    });
    saved.push(mistake);

    await analyticsService.track(user.id, "mistake_created", {
      errorType: err.errorType,
      skill: err.skill,
    });

    const lp = await prisma.learningProfile.findUnique({
      where: { userId: user.id },
    });
    if (lp) {
      const problematic = new Set(parseJsonArray(lp.problematicGrammarTopics));
      const topic = contentService.getGrammarByErrorType(err.errorType);
      if (topic) problematic.add(topic.id);
      const consolidate = new Set(parseJsonArray(lp.topicsToConsolidate));
      if (topic) consolidate.add(topic.id);

      await prisma.learningProfile.update({
        where: { userId: user.id },
        data: {
          problematicGrammarTopics: toJsonArray([...problematic]),
          topicsToConsolidate: toJsonArray([...consolidate]),
          grammarScore: Math.max(0, lp.grammarScore - 2),
        },
      });
    }
  }

  return NextResponse.json({
    errors: detected,
    recommendations: errorEngine.recommendTopics(
      detected.map((d) => d.errorType)
    ),
    savedCount: saved.length,
  });
}
