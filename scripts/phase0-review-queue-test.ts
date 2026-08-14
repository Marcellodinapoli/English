/**
 * Phase 0 ReviewQueue verification (cases A–F).
 * Run: npx tsx scripts/phase0-review-queue-test.ts
 */
import { PrismaClient } from "@prisma/client";
import { spacedRepetition } from "../src/services/learning/SpacedRepetition";

const prisma = new PrismaClient();

async function ensureTestUser() {
  const email = "phase0-review-queue@test.local";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: "test",
        name: "Phase0 Test",
        progress: { create: {} },
        learningProfile: { create: {} },
      },
    });
  }
  return user;
}

async function main() {
  const results: Array<{ case: string; ok: boolean; detail: string }> = [];
  const user = await ensureTestUser();

  // Clean prior test review/vocab/mistakes for isolation
  await prisma.reviewItem.deleteMany({ where: { userId: user.id } });
  await prisma.userMistake.deleteMany({ where: { userId: user.id } });
  await prisma.userVocabulary.deleteMany({ where: { userId: user.id } });

  // Dynamic import after client generate so types include new fields
  const { reviewQueue } = await import(
    "../src/services/learning/ReviewQueueService"
  );

  // --- A: save word → ReviewQueue ---
  const vocab = await prisma.userVocabulary.create({
    data: {
      userId: user.id,
      word: "apple",
      lemma: "apple",
      translation: "mela",
      partOfSpeech: "noun",
      level: "A1",
      status: "NEW",
      nextReviewAt: new Date(),
    },
  });
  // Make due now for listDue
  const dueNow = new Date(Date.now() - 60_000);
  await reviewQueue.enqueue({
    userId: user.id,
    itemType: "VOCABULARY",
    itemId: vocab.id,
    skill: "vocabulary",
    source: "vocabulary_save",
    level: "A1",
    context: "I like apples.",
    contentRef: "reading-demo",
    dueInMinutes: -1, // will still set future; fix below
    bumpDueOnUpdate: false,
  });
  await prisma.reviewItem.updateMany({
    where: { userId: user.id, itemType: "VOCABULARY", itemId: vocab.id },
    data: { nextReviewAt: dueNow },
  });

  const dueA = await reviewQueue.listDue(user.id, 20);
  const hasVocab = dueA.items.some(
    (i) => i.itemType === "VOCABULARY" && i.itemId === vocab.id
  );
  results.push({
    case: "A",
    ok: hasVocab,
    detail: hasVocab
      ? "VOCABULARY item present in due queue"
      : "VOCABULARY missing from due queue",
  });

  // --- B: wrong answer → mistake + review ---
  const { mistake, reviewItem } = await reviewQueue.recordMistakeAndEnqueue({
    userId: user.id,
    errorType: "past_simple",
    skill: "grammar",
    userInput: "I go yesterday",
    correctForm: "I went yesterday.",
    context: "lesson-test",
    lessonId: "lesson-test",
    source: "lesson_complete",
    dueInMinutes: 0,
  });
  await prisma.reviewItem.update({
    where: { id: reviewItem.id },
    data: { nextReviewAt: dueNow },
  });
  const dueB = await reviewQueue.listDue(user.id, 50);
  const hasMistake = dueB.items.some(
    (i) => i.itemType === "MISTAKE" && i.itemId === mistake.id
  );
  results.push({
    case: "B",
    ok: Boolean(mistake && reviewItem && hasMistake),
    detail: `mistake=${mistake.id} review=${reviewItem.id} inDue=${hasMistake}`,
  });

  // --- C: same error again → no duplicate ReviewItem ---
  const beforeCount = await prisma.reviewItem.count({
    where: { userId: user.id, itemType: "MISTAKE" },
  });
  const second = await reviewQueue.recordMistakeAndEnqueue({
    userId: user.id,
    errorType: "past_simple",
    skill: "grammar",
    userInput: "I go yesterday",
    correctForm: "I went yesterday.",
    context: "lesson-test",
    lessonId: "lesson-test",
    source: "lesson_complete",
  });
  const afterCount = await prisma.reviewItem.count({
    where: { userId: user.id, itemType: "MISTAKE" },
  });
  const refreshed = await prisma.reviewItem.findUnique({
    where: { id: reviewItem.id },
  });
  const okC =
    second.mistake.id === mistake.id &&
    afterCount === beforeCount &&
    (refreshed?.errorCount ?? 0) >= 2 &&
    second.mistake.frequency >= 2;
  results.push({
    case: "C",
    ok: okC,
    detail: `sameMistake=${second.mistake.id === mistake.id} count=${beforeCount}→${afterCount} errorCount=${refreshed?.errorCount} freq=${second.mistake.frequency}`,
  });

  // --- D: complete review → SM-2 next date ---
  const beforeSm2 = await prisma.reviewItem.findUnique({
    where: { id: reviewItem.id },
  });
  const expected = spacedRepetition.schedule(
    {
      masteryScore: beforeSm2!.masteryScore,
      interval: beforeSm2!.interval,
      easeFactor: beforeSm2!.easeFactor,
      reviewCount: beforeSm2!.reviewCount,
      nextReviewAt: beforeSm2!.nextReviewAt,
      lastReviewedAt: beforeSm2!.lastReviewedAt,
      lastResult: beforeSm2!.lastResult,
    },
    4
  );
  const completed = await reviewQueue.complete(user.id, reviewItem.id, 4);
  const okD =
    !!completed &&
    completed.interval === expected.interval &&
    completed.reviewCount === expected.reviewCount &&
    Math.abs(
      completed.nextReviewAt.getTime() - expected.nextReviewAt.getTime()
    ) < 2000;
  results.push({
    case: "D",
    ok: okD,
    detail: `interval=${completed?.interval} next=${completed?.nextReviewAt.toISOString()} expectedInterval=${expected.interval}`,
  });

  // --- E: mastery updated ---
  const vocabItem = await prisma.reviewItem.findFirst({
    where: { userId: user.id, itemType: "VOCABULARY", itemId: vocab.id },
  });
  const beforeMastery = vocabItem!.masteryScore;
  const afterVocabReview = await reviewQueue.complete(user.id, vocabItem!.id, 5);
  const vocabRow = await prisma.userVocabulary.findUnique({
    where: { id: vocab.id },
  });
  const okE =
    !!afterVocabReview &&
    afterVocabReview.masteryScore > beforeMastery &&
    vocabRow!.masteryScore === afterVocabReview.masteryScore;
  results.push({
    case: "E",
    ok: okE,
    detail: `reviewMastery ${beforeMastery}→${afterVocabReview?.masteryScore} vocabMastery=${vocabRow?.masteryScore}`,
  });

  // --- F: legacy items without new fields still listable ---
  const legacyMistake = await prisma.userMistake.create({
    data: {
      userId: user.id,
      errorType: "accuracy",
      skill: "vocabulary",
      userInput: "cat",
      correctForm: "dog",
      context: "legacy",
    },
  });
  const legacyReview = await prisma.reviewItem.create({
    data: {
      userId: user.id,
      itemType: "MISTAKE",
      itemId: legacyMistake.id,
      nextReviewAt: dueNow,
      // skill/source/etc intentionally omitted (null) — legacy shape
    },
  });
  const dueF = await reviewQueue.listDue(user.id, 50);
  const hasLegacy = dueF.items.some((i) => i.reviewId === legacyReview.id);
  results.push({
    case: "F",
    ok: hasLegacy,
    detail: hasLegacy
      ? `legacy review ${legacyReview.id} listed`
      : "legacy review missing",
  });

  console.log("\n=== Phase 0 ReviewQueue tests ===\n");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} [${r.case}] ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    process.exitCode = 1;
    console.log(`\n${failed.length} failed`);
  } else {
    console.log("\nAll A–F passed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
