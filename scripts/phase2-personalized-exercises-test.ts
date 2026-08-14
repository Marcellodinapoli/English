/**
 * Phase 2 personalized exercises (A–L).
 * Run: npx tsx scripts/phase2-personalized-exercises-test.ts
 */
import { PrismaClient } from "@prisma/client";
import { exerciseEngine } from "../src/services/learning/ExerciseEngine";
import { contentService } from "../src/services/content/ContentService";
import { ruleBasedExerciseProvider } from "../src/services/learning/exercise-providers/RuleBasedExerciseProvider";

const prisma = new PrismaClient();

async function ensureUser() {
  const email = "phase2-practice@test.local";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: "test",
        name: "Phase2 Test",
        progress: { create: {} },
        learningProfile: {
          create: {
            currentLevel: "A1",
            vocabularyScore: 30,
            grammarScore: 80,
            readingScore: 40,
          },
        },
      },
    });
  }
  return user;
}

async function main() {
  const results: Array<{ case: string; ok: boolean; detail: string }> = [];
  const user = await ensureUser();

  await prisma.personalizedExerciseAttempt.deleteMany({
    where: { userId: user.id },
  });
  await prisma.reviewItem.deleteMany({ where: { userId: user.id } });
  await prisma.userMistake.deleteMany({ where: { userId: user.id } });
  await prisma.userVocabulary.deleteMany({ where: { userId: user.id } });
  await prisma.userExpression.deleteMany({ where: { userId: user.id } });

  const { personalizedExerciseSources } = await import(
    "../src/services/learning/PersonalizedExerciseSourceService"
  );
  const { personalizedExerciseService } = await import(
    "../src/services/learning/PersonalizedExerciseService"
  );
  const { reviewQueue } = await import(
    "../src/services/learning/ReviewQueueService"
  );

  const duePast = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const although = await prisma.userVocabulary.create({
    data: {
      userId: user.id,
      word: "although",
      lemma: "although",
      translation: "sebbene",
      partOfSpeech: "conjunction",
      exampleSentence: "Although John was tired, he continued working.",
      exampleTranslation: "Sebbene John fosse stanco, ha continuato a lavorare.",
      level: "B1",
      masteryScore: 8,
      status: "LEARNING",
      nextReviewAt: future,
    },
  });
  await reviewQueue.enqueue({
    userId: user.id,
    itemType: "VOCABULARY",
    itemId: although.id,
    skill: "vocabulary",
    source: "vocabulary_save",
    dueInMinutes: 24 * 60,
  });

  const lookForward = await prisma.userExpression.create({
    data: {
      userId: user.id,
      expressionId: "expr-look-forward-to",
      expression: "look forward to",
      translation: "non vedere l'ora di",
      example: "I look forward to seeing you.",
      exampleTranslation: "Non vedo l'ora di vederti.",
      level: "B1",
      category: "phrasal_verb",
      masteryScore: 5,
      status: "NEW",
      nextReviewAt: future,
    },
  });
  await reviewQueue.enqueue({
    userId: user.id,
    itemType: "EXPRESSION",
    itemId: lookForward.id,
    skill: "expression",
    source: "expression_save",
    dueInMinutes: 24 * 60,
  });

  const dueWord = await prisma.userVocabulary.create({
    data: {
      userId: user.id,
      word: "bus",
      lemma: "bus",
      translation: "autobus",
      partOfSpeech: "noun",
      exampleSentence: "I go to work by bus.",
      level: "A1",
      masteryScore: 40,
      status: "LEARNING",
      nextReviewAt: duePast,
    },
  });
  await prisma.reviewItem.create({
    data: {
      userId: user.id,
      itemType: "VOCABULARY",
      itemId: dueWord.id,
      nextReviewAt: duePast,
      masteryScore: 40,
      skill: "vocabulary",
    },
  });

  const { mistake: readingMistake } = await reviewQueue.recordMistakeAndEnqueue({
    userId: user.id,
    errorType: "main_idea",
    skill: "reading",
    userInput: "A shopping list",
    correctForm: "My day",
    context: "What is the main idea of this text?",
    source: "reading_comprehension",
    contentRef: "a1-my-day",
    dueInMinutes: 30,
  });

  const { mistake: grammarMistake } = await reviewQueue.recordMistakeAndEnqueue({
    userId: user.id,
    errorType: "past_simple",
    skill: "grammar",
    userInput: "I go yesterday",
    correctForm: "I went yesterday.",
    context: "lesson-test",
    source: "lesson_complete",
    dueInMinutes: 30,
  });

  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: {
      problematicGrammarTopics: JSON.stringify(["grammar-a2-past-simple"]),
      grammarScore: 80,
      vocabularyScore: 30,
      readingScore: 40,
    },
  });

  const sources = await personalizedExerciseSources.collect(user.id);

  const hasWord = sources.targets.some(
    (t) => t.itemType === "VOCABULARY" && t.itemId === although.id
  );
  results.push({
    case: "A",
    ok: hasWord,
    detail: hasWord
      ? "although present in exercise sources"
      : "although missing from sources",
  });

  const hasExpr = sources.targets.some(
    (t) => t.itemType === "EXPRESSION" && t.itemId === lookForward.id
  );
  results.push({
    case: "B",
    ok: hasExpr,
    detail: hasExpr
      ? "look forward to present in sources"
      : "expression missing",
  });

  const hasReading = sources.targets.some(
    (t) => t.itemType === "MISTAKE" && t.itemId === readingMistake.id
  );
  results.push({
    case: "C",
    ok: hasReading,
    detail: hasReading
      ? "reading mistake in sources"
      : "reading mistake missing",
  });

  const hasGrammar =
    sources.targets.some(
      (t) => t.itemType === "MISTAKE" && t.itemId === grammarMistake.id
    ) ||
    sources.targets.some(
      (t) => t.itemType === "GRAMMAR" && t.itemId === "grammar-a2-past-simple"
    );
  results.push({
    case: "D",
    ok: hasGrammar,
    detail: hasGrammar
      ? "grammar weakness/mistake in sources"
      : "grammar missing",
  });

  const top = sources.targets[0];
  const dueTarget = sources.targets.find(
    (t) => t.itemId === dueWord.id && t.due
  );
  const althoughTarget = sources.targets.find((t) => t.itemId === although.id);
  results.push({
    case: "E",
    ok: Boolean(dueTarget && althoughTarget && dueTarget.priority > althoughTarget.priority),
    detail: `top=${top?.label}:${top?.kind}:${Math.round(top?.priority || 0)} due=${dueTarget?.priority} although=${althoughTarget?.priority}`,
  });

  const highMastery = await prisma.userVocabulary.create({
    data: {
      userId: user.id,
      word: "hello",
      lemma: "hello",
      translation: "ciao",
      partOfSpeech: "interjection",
      level: "ZERO",
      masteryScore: 92,
      status: "MASTERED",
      nextReviewAt: future,
      savedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  });
  const sources2 = await personalizedExerciseSources.collect(user.id);
  const low = sources2.targets.find((t) => t.itemId === although.id);
  const high = sources2.targets.find((t) => t.itemId === highMastery.id);
  results.push({
    case: "F",
    ok: Boolean(low && (!high || low.priority > high.priority)),
    detail: `low=${low?.priority} high=${high?.priority ?? "absent"}`,
  });

  const sessionA = await personalizedExerciseService.generateSession(user.id, {
    count: 5,
    provider: "rule",
  });
  const sessionB = await personalizedExerciseService.generateSession(user.id, {
    count: 5,
    provider: "rule",
  });
  const idsA = sessionA.items.map((i) => i.exercise.id).join(",");
  const idsB = sessionB.items.map((i) => i.exercise.id).join(",");
  const hasAlthoughEx = sessionA.items.some(
    (i) =>
      i.target.itemId === although.id ||
      String(i.exercise.prompt).toLowerCase().includes("although") ||
      String(i.exercise.answer).toLowerCase().includes("although")
  );
  results.push({
    case: "G",
    ok: idsA === idsB && sessionA.items.length > 0 && hasAlthoughEx,
    detail: `n=${sessionA.items.length} deterministic=${idsA === idsB} althoughEx=${hasAlthoughEx} types=${sessionA.items.map((i) => i.pedagogicalType).join("|")}`,
  });

  const vocabItem = sessionA.items.find((i) => i.target.itemId === although.id);
  const beforeLp = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  const beforeVocab = await prisma.userVocabulary.findUnique({
    where: { id: although.id },
  });
  if (vocabItem) {
    const expected = vocabItem.exercise.answer;
    const outcome = await personalizedExerciseService.completeSession(
      user.id,
      [vocabItem],
      [
        {
          exerciseId: vocabItem.exercise.id,
          userAnswer: expected,
        },
      ]
    );
    const afterVocab = await prisma.userVocabulary.findUnique({
      where: { id: although.id },
    });
    const afterLp = await prisma.learningProfile.findUnique({
      where: { userId: user.id },
    });
    results.push({
      case: "H",
      ok:
        outcome.result.score === 100 &&
        (afterVocab?.masteryScore || 0) > (beforeVocab?.masteryScore || 0) &&
        (afterLp?.vocabularyScore || 0) >= (beforeLp?.vocabularyScore || 0),
      detail: `item ${beforeVocab?.masteryScore}→${afterVocab?.masteryScore} vocabSkill ${beforeLp?.vocabularyScore}→${afterLp?.vocabularyScore}`,
    });
  } else {
    results.push({
      case: "H",
      ok: false,
      detail: "no although exercise generated",
    });
  }

  const exprItem =
    sessionA.items.find((i) => i.target.itemId === lookForward.id) ||
    (
      await personalizedExerciseService.generateSession(user.id, { count: 8 })
    ).items.find((i) => i.target.itemId === lookForward.id);

  if (exprItem) {
    const beforeMistakes = await prisma.userMistake.count({
      where: { userId: user.id },
    });
    const beforeReviews = await prisma.reviewItem.count({
      where: { userId: user.id, itemType: "MISTAKE" },
    });
    await personalizedExerciseService.completeSession(
      user.id,
      [exprItem],
      [{ exerciseId: exprItem.exercise.id, userAnswer: "WRONG" }]
    );
    const afterMistakes = await prisma.userMistake.count({
      where: { userId: user.id },
    });
    const afterReviews = await prisma.reviewItem.count({
      where: { userId: user.id, itemType: "MISTAKE" },
    });
    results.push({
      case: "I",
      ok: afterMistakes > beforeMistakes && afterReviews >= beforeReviews,
      detail: `mistakes ${beforeMistakes}→${afterMistakes} mistakeReviews ${beforeReviews}→${afterReviews}`,
    });

    const beforeDupMistakes = await prisma.userMistake.count({
      where: { userId: user.id },
    });
    const beforeDupReviews = await prisma.reviewItem.count({
      where: { userId: user.id, itemType: "MISTAKE" },
    });
    await personalizedExerciseService.completeSession(
      user.id,
      [exprItem],
      [{ exerciseId: exprItem.exercise.id, userAnswer: "WRONG" }]
    );
    const afterDupMistakes = await prisma.userMistake.count({
      where: { userId: user.id },
    });
    const afterDupReviews = await prisma.reviewItem.count({
      where: { userId: user.id, itemType: "MISTAKE" },
    });
    const bumped = await prisma.userMistake.findFirst({
      where: {
        userId: user.id,
        userInput: "WRONG",
        resolved: false,
      },
    });
    results.push({
      case: "J",
      ok:
        afterDupMistakes === beforeDupMistakes &&
        afterDupReviews === beforeDupReviews &&
        (bumped?.frequency || 0) >= 2,
      detail: `mistakes ${beforeDupMistakes}→${afterDupMistakes} reviews ${beforeDupReviews}→${afterDupReviews} freq=${bumped?.frequency}`,
    });
  } else {
    results.push({ case: "I", ok: false, detail: "no expression exercise" });
    results.push({ case: "J", ok: false, detail: "skipped without I" });
  }

  const topic = contentService.getGrammar("grammar-a2-past-simple");
  const staticEval = exerciseEngine.evaluateSession(topic!.exercises, [
    { exerciseId: "g1", userAnswer: "Last weekend I met my friends." },
    { exerciseId: "g2", userAnswer: "went" },
    { exerciseId: "g3", userAnswer: "We watched a film last night." },
  ]);
  results.push({
    case: "K",
    ok: staticEval.score === 100 && staticEval.total === 3,
    detail: `static grammar score=${staticEval.score} total=${staticEval.total}`,
  });

  const ruleDirect = await ruleBasedExerciseProvider.generate({
    userId: user.id,
    userLevel: "A1",
    count: 3,
    targets: sources.targets,
  });
  results.push({
    case: "L",
    ok: ruleDirect.length > 0 && sources.savedWords.length >= 1,
    detail: `phase0/1 data reused: words=${sources.savedWords.length} expr=${sources.savedExpressions.length} generated=${ruleDirect.length}`,
  });

  console.log("\n=== Phase 2 personalized exercises ===\n");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} [${r.case}] ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    process.exitCode = 1;
    console.log(`\n${failed.length} failed`);
  } else {
    console.log("\nAll A–L passed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
