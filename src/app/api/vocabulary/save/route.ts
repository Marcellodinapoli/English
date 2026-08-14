import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { processGamification } from "@/lib/gamification";
import { reviewQueue } from "@/services/learning/ReviewQueueService";

const schema = z.object({
  word: z.string().min(1),
  lemma: z.string().min(1),
  translation: z.string().min(1),
  partOfSpeech: z.string().min(1),
  pronunciation: z.string().optional(),
  phonetic: z.string().optional(),
  exampleSentence: z.string().optional(),
  exampleTranslation: z.string().optional(),
  context: z.string().optional(),
  level: z.string().optional(),
  sourceContentId: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await request.json());
  const word = body.word.toLowerCase();
  const lemma = body.lemma.toLowerCase();
  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + 1);

  const existing = await prisma.userVocabulary.findUnique({
    where: {
      userId_word_lemma: {
        userId: user.id,
        word,
        lemma,
      },
    },
  });

  const item = existing
    ? await prisma.userVocabulary.update({
        where: { id: existing.id },
        data: {
          translation: body.translation,
          partOfSpeech: body.partOfSpeech,
          phonetic: body.phonetic,
          exampleSentence: body.exampleSentence || "",
          exampleTranslation: body.exampleTranslation || "",
          context: body.context,
        },
      })
    : await prisma.userVocabulary.create({
        data: {
          userId: user.id,
          word,
          lemma,
          translation: body.translation,
          partOfSpeech: body.partOfSpeech,
          pronunciation: body.pronunciation || "",
          phonetic: body.phonetic,
          exampleSentence: body.exampleSentence || "",
          exampleTranslation: body.exampleTranslation || "",
          context: body.context,
          level: body.level || "A1",
          sourceContentId: body.sourceContentId,
          status: "NEW",
          nextReviewAt,
        },
      });

  const isNew = !existing;

  await reviewQueue.enqueue({
    userId: user.id,
    itemType: "VOCABULARY",
    itemId: item.id,
    skill: "vocabulary",
    source: "vocabulary_save",
    level: body.level || item.level || "A1",
    contentRef: body.sourceContentId,
    context: body.context || body.exampleSentence,
    dueInMinutes: 24 * 60,
    bumpDueOnUpdate: false,
  });

  if (isNew) {
    await prisma.userProgress.update({
      where: { userId: user.id },
      data: {
        wordsLearned: { increment: 1 },
        xp: { increment: 5 },
      },
    });

    await analyticsService.track(user.id, "word_saved", {
      word: body.word,
      lemma: body.lemma,
    });
  }

  const gamification = await processGamification(user.id);

  return NextResponse.json({ item, gamification, created: isNew });
}
