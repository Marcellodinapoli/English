/**
 * Phase 1 Reading cycle tests (A–I).
 * Run: npx tsx scripts/phase1-reading-cycle-test.ts
 */
import { PrismaClient } from "@prisma/client";
import { findExpressionSpans } from "../src/services/content/ExpressionMatcher";
import { expressionService } from "../src/services/content/ExpressionService";
import { contentService } from "../src/services/content/ContentService";
import { spacedRepetition } from "../src/services/learning/SpacedRepetition";
import { adaptiveEngine } from "../src/services/learning/AdaptiveEngine";
import { exerciseEngine } from "../src/services/learning/ExerciseEngine";
import { comprehensionToExercise } from "../src/lib/comprehension";

const prisma = new PrismaClient();

async function ensureUser() {
  const email = "phase1-reading-cycle@test.local";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: "test",
        name: "Phase1 Test",
        progress: { create: {} },
        learningProfile: { create: { readingScore: 40 } },
      },
    });
  }
  return user;
}

async function main() {
  const results: Array<{ case: string; ok: boolean; detail: string }> = [];
  const user = await ensureUser();
  await prisma.reviewItem.deleteMany({ where: { userId: user.id } });
  await prisma.userMistake.deleteMany({ where: { userId: user.id } });
  await prisma.userVocabulary.deleteMany({ where: { userId: user.id } });
  await prisma.userExpression.deleteMany({ where: { userId: user.id } });
  await prisma.readingComprehensionAttempt.deleteMany({
    where: { userId: user.id },
  });

  const { reviewQueue } = await import(
    "../src/services/learning/ReviewQueueService"
  );

  // --- A: word save → VOCABULARY ReviewQueue ---
  const vocab = await prisma.userVocabulary.create({
    data: {
      userId: user.id,
      word: "bus",
      lemma: "bus",
      translation: "autobus",
      partOfSpeech: "noun",
      level: "A1",
      status: "NEW",
      sourceContentId: "a1-my-day",
    },
  });
  await reviewQueue.enqueue({
    userId: user.id,
    itemType: "VOCABULARY",
    itemId: vocab.id,
    skill: "vocabulary",
    source: "vocabulary_save",
    contentRef: "a1-my-day",
    dueInMinutes: 0,
  });
  const vocabReview = await prisma.reviewItem.findUnique({
    where: {
      userId_itemType_itemId: {
        userId: user.id,
        itemType: "VOCABULARY",
        itemId: vocab.id,
      },
    },
  });
  results.push({
    case: "A",
    ok: Boolean(vocabReview),
    detail: vocabReview
      ? `VOCABULARY queued ${vocabReview.id}`
      : "missing VOCABULARY review",
  });

  // --- B: multi-word expression click matching ---
  const passage = contentService.getPassage("a1-my-day");
  const tokens = passage!.sentences[0].tokens;
  const spans = findExpressionSpans(tokens, expressionService.listCatalog());
  const wakeUp = spans.find((s) => s.expression.expression === "wake up");
  const everyDay = spans.find((s) => s.expression.expression === "every day");
  results.push({
    case: "B",
    ok: Boolean(wakeUp && everyDay),
    detail: `spans=${spans.map((s) => s.expression.expression).join(", ")}`,
  });

  // --- C: save expression → EXPRESSION ReviewQueue ---
  const expr = await prisma.userExpression.create({
    data: {
      userId: user.id,
      expressionId: "expr-wake-up",
      expression: "wake up",
      translation: "svegliarsi",
      level: "A1",
      category: "phrasal_verb",
      example: "I wake up at seven.",
      status: "NEW",
    },
  });
  await reviewQueue.enqueue({
    userId: user.id,
    itemType: "EXPRESSION",
    itemId: expr.id,
    skill: "expression",
    source: "expression_save",
    contentRef: "a1-my-day",
    dueInMinutes: 0,
  });
  const exprReview = await prisma.reviewItem.findUnique({
    where: {
      userId_itemType_itemId: {
        userId: user.id,
        itemType: "EXPRESSION",
        itemId: expr.id,
      },
    },
  });
  results.push({
    case: "C",
    ok: Boolean(exprReview),
    detail: exprReview
      ? `EXPRESSION queued ${exprReview.id}`
      : "missing EXPRESSION review",
  });

  // --- D: comprehension correct → reading mastery up ---
  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: { readingScore: 40 },
  });
  const set = contentService.getComprehension("a1-my-day");
  const exercises = set!.questions.map(comprehensionToExercise);
  const correctAttempts = exercises.map((ex) => ({
    exerciseId: ex.id,
    userAnswer: Array.isArray(ex.answer) ? ex.answer : ex.answer,
  }));
  const good = exerciseEngine.evaluateSession(exercises, correctAttempts);
  const lpBefore = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  const nextReading = adaptiveEngine.updateMastery(
    lpBefore!.readingScore,
    good.score / 100
  );
  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: { readingScore: nextReading },
  });
  await prisma.readingComprehensionAttempt.create({
    data: {
      userId: user.id,
      passageId: "a1-my-day",
      totalQuestions: good.total,
      correctCount: good.correctCount,
      wrongCount: 0,
      accuracy: good.score / 100,
      results: JSON.stringify(good.evaluations),
    },
  });
  const lpAfter = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  results.push({
    case: "D",
    ok: good.score === 100 && lpAfter!.readingScore > lpBefore!.readingScore,
    detail: `score=${good.score} reading ${lpBefore!.readingScore}→${lpAfter!.readingScore}`,
  });

  // --- E: wrong comprehension → MISTAKE in queue ---
  const wrongAttempts = exercises.map((ex, i) => ({
    exerciseId: ex.id,
    userAnswer: i === 0 ? "WRONG ANSWER" : (Array.isArray(ex.answer) ? ex.answer : ex.answer),
  }));
  const mixed = exerciseEngine.evaluateSession(exercises, wrongAttempts);
  const wrongEval = mixed.evaluations.find((e) => !e.correct)!;
  const { mistake, reviewItem } = await reviewQueue.recordMistakeAndEnqueue({
    userId: user.id,
    errorType: "main_idea",
    skill: "reading",
    userInput: String(wrongEval.userAnswer),
    correctForm: String(wrongEval.expected),
    context: "What is the main idea of this text?",
    source: "reading_comprehension",
    contentRef: "a1-my-day",
    dueInMinutes: 0,
  });
  results.push({
    case: "E",
    ok: Boolean(mistake && reviewItem && reviewItem.itemType === "MISTAKE"),
    detail: `mistake=${mistake.id} reviewType=${reviewItem.itemType}`,
  });

  // --- F: same error again → no duplicate ---
  const before = await prisma.reviewItem.count({
    where: { userId: user.id, itemType: "MISTAKE" },
  });
  const again = await reviewQueue.recordMistakeAndEnqueue({
    userId: user.id,
    errorType: "main_idea",
    skill: "reading",
    userInput: String(wrongEval.userAnswer),
    correctForm: String(wrongEval.expected),
    context: "What is the main idea of this text?",
    source: "reading_comprehension",
    contentRef: "a1-my-day",
  });
  const after = await prisma.reviewItem.count({
    where: { userId: user.id, itemType: "MISTAKE" },
  });
  const refreshed = await prisma.reviewItem.findUnique({
    where: { id: reviewItem.id },
  });
  results.push({
    case: "F",
    ok:
      again.mistake.id === mistake.id &&
      after === before &&
      (refreshed?.errorCount ?? 0) >= 2,
    detail: `same=${again.mistake.id === mistake.id} count=${before}→${after} errorCount=${refreshed?.errorCount}`,
  });

  // --- G: expression review → SM-2 ---
  const beforeExpr = await prisma.reviewItem.findUnique({
    where: { id: exprReview!.id },
  });
  const expected = spacedRepetition.schedule(
    {
      masteryScore: beforeExpr!.masteryScore,
      interval: beforeExpr!.interval,
      easeFactor: beforeExpr!.easeFactor,
      reviewCount: beforeExpr!.reviewCount,
      nextReviewAt: beforeExpr!.nextReviewAt,
      lastReviewedAt: beforeExpr!.lastReviewedAt,
      lastResult: beforeExpr!.lastResult,
    },
    5
  );
  const completed = await reviewQueue.complete(user.id, exprReview!.id, 5);
  const exprRow = await prisma.userExpression.findUnique({
    where: { id: expr.id },
  });
  results.push({
    case: "G",
    ok:
      !!completed &&
      completed.interval === expected.interval &&
      exprRow!.masteryScore === completed.masteryScore &&
      exprRow!.reviewCount === 1,
    detail: `interval=${completed?.interval} mastery=${exprRow?.masteryScore} reviews=${exprRow?.reviewCount}`,
  });

  // --- H: old vocabulary path still works (upsert word + enqueue) ---
  const vocab2 = await prisma.userVocabulary.upsert({
    where: {
      userId_word_lemma: {
        userId: user.id,
        word: "lunch",
        lemma: "lunch",
      },
    },
    create: {
      userId: user.id,
      word: "lunch",
      lemma: "lunch",
      translation: "pranzo",
      partOfSpeech: "noun",
      level: "A1",
      status: "NEW",
    },
    update: { translation: "pranzo" },
  });
  await reviewQueue.enqueue({
    userId: user.id,
    itemType: "VOCABULARY",
    itemId: vocab2.id,
    skill: "vocabulary",
    source: "vocabulary_save",
    bumpDueOnUpdate: false,
    dueInMinutes: 24 * 60,
  });
  const h = await prisma.reviewItem.findUnique({
    where: {
      userId_itemType_itemId: {
        userId: user.id,
        itemType: "VOCABULARY",
        itemId: vocab2.id,
      },
    },
  });
  results.push({
    case: "H",
    ok: Boolean(h),
    detail: h ? `legacy vocab path ok ${h.id}` : "vocab enqueue failed",
  });

  // --- I: legacy ReviewItem without enrichment still listable ---
  const legacyMistake = await prisma.userMistake.create({
    data: {
      userId: user.id,
      errorType: "accuracy",
      skill: "vocabulary",
      userInput: "old",
      correctForm: "new",
    },
  });
  const dueNow = new Date(Date.now() - 60_000);
  const legacy = await prisma.reviewItem.create({
    data: {
      userId: user.id,
      itemType: "MISTAKE",
      itemId: legacyMistake.id,
      nextReviewAt: dueNow,
    },
  });
  const listed = await reviewQueue.listDue(user.id, 50);
  const hasLegacy = listed.items.some((i) => i.reviewId === legacy.id);
  const hasExpr = listed.items.some(
    (i) => i.itemType === "EXPRESSION" || i.itemId === expr.id
  );
  // expression may not be due if complete moved nextReviewAt forward — check DB still valid
  const exprStillThere = await prisma.reviewItem.findUnique({
    where: { id: exprReview!.id },
  });
  results.push({
    case: "I",
    ok: hasLegacy && Boolean(exprStillThere),
    detail: `legacyListed=${hasLegacy} exprCompat=${Boolean(exprStillThere)} dueHasExpr=${hasExpr}`,
  });

  console.log("\n=== Phase 1 Reading cycle tests ===\n");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} [${r.case}] ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    process.exitCode = 1;
    console.log(`\n${failed.length} failed`);
  } else {
    console.log("\nAll A–I passed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
