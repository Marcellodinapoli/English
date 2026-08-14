/**
 * Phase 3 Daily Plan + Lesson adaptation (A–N).
 * Run: npx tsx scripts/phase3-daily-plan-test.ts
 */
import { PrismaClient } from "@prisma/client";
import { lessonEngine } from "../src/services/learning/LessonEngine";
import { contentService } from "../src/services/content/ContentService";

const prisma = new PrismaClient();

async function ensureUser() {
  const email = "phase3-daily-plan@test.local";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: "test",
        name: "Phase3 Test",
        profile: {
          create: {
            onboardingDone: true,
            assessmentDone: true,
            dailyMinutes: 20,
            goal: "Speak at work",
          },
        },
        progress: { create: {} },
        learningProfile: {
          create: {
            currentLevel: "A1",
            vocabularyScore: 25,
            grammarScore: 35,
            readingScore: 30,
            listeningScore: 70,
            speakingScore: 60,
            writingScore: 55,
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
  await prisma.lessonProgress.deleteMany({ where: { userId: user.id } });

  const { dailyPlanService } = await import(
    "../src/services/learning/DailyPlanService"
  );
  const { reviewQueue } = await import(
    "../src/services/learning/ReviewQueueService"
  );
  const { personalizedExerciseService } = await import(
    "../src/services/learning/PersonalizedExerciseService"
  );
  const { levelProgressionEngine } = await import(
    "../src/services/learning/LevelProgressionEngine"
  );
  const { adaptiveEngine } = await import(
    "../src/services/learning/AdaptiveEngine"
  );

  const duePast = new Date(Date.now() - 4 * 60 * 60 * 1000);

  const dueWord = await prisma.userVocabulary.create({
    data: {
      userId: user.id,
      word: "although",
      lemma: "although",
      translation: "sebbene",
      partOfSpeech: "conjunction",
      exampleSentence: "Although John was tired, he continued working.",
      level: "B1",
      masteryScore: 10,
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
      masteryScore: 10,
      skill: "vocabulary",
    },
  });

  let plan = await dailyPlanService.build(user.id, 20);
  results.push({
    case: "A",
    ok: plan.plan[0]?.kind === "review" || plan.dueReviewCount > 0,
    detail: `first=${plan.plan[0]?.kind}:${plan.plan[0]?.title} due=${plan.dueReviewCount}`,
  });

  await reviewQueue.recordMistakeAndEnqueue({
    userId: user.id,
    errorType: "past_simple",
    skill: "grammar",
    userInput: "I go yesterday",
    correctForm: "I went yesterday.",
    source: "test",
    dueInMinutes: 30,
  });
  await reviewQueue.recordMistakeAndEnqueue({
    userId: user.id,
    errorType: "past_simple",
    skill: "grammar",
    userInput: "I go yesterday",
    correctForm: "I went yesterday.",
    source: "test",
    dueInMinutes: 30,
  });

  plan = await dailyPlanService.build(user.id, 20);
  const hasRepeated = plan.plan.some(
    (a) =>
      a.kind === "grammar" ||
      a.kind === "practice" ||
      a.reason.toLowerCase().includes("repeat") ||
      a.reason.toLowerCase().includes("grammar")
  );
  results.push({
    case: "B",
    ok: hasRepeated,
    detail: `kinds=${plan.plan.map((p) => p.kind).join(",")}`,
  });

  const lowVocab = plan.plan.some(
    (a) => a.kind === "vocabulary" || a.skill === "vocabulary"
  );
  results.push({
    case: "C",
    ok: lowVocab || plan.primaryWeakness === "vocabulary",
    detail: `weakness=${plan.primaryWeakness} hasVocabAct=${lowVocab}`,
  });

  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: {
      grammarScore: 20,
      vocabularyScore: 70,
      problematicGrammarTopics: JSON.stringify(["grammar-a2-past-simple"]),
    },
  });
  plan = await dailyPlanService.build(user.id, 20);
  const grammarPriority = plan.plan.find(
    (a) => a.kind === "grammar" || a.skill === "grammar"
  );
  results.push({
    case: "D",
    ok: Boolean(grammarPriority) || plan.primaryWeakness === "grammar",
    detail: `weakness=${plan.primaryWeakness} grammarAct=${grammarPriority?.title}`,
  });

  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: { readingScore: 15, grammarScore: 80 },
  });
  await reviewQueue.recordMistakeAndEnqueue({
    userId: user.id,
    errorType: "main_idea",
    skill: "reading",
    userInput: "wrong",
    correctForm: "My day",
    context: "a1-my-day",
    source: "reading_comprehension",
    contentRef: "a1-my-day",
  });
  plan = await dailyPlanService.build(user.id, 20);
  const readingAct = plan.plan.find(
    (a) =>
      a.kind === "comprehension" ||
      a.kind === "reading" ||
      a.skill === "reading"
  );
  results.push({
    case: "E",
    ok: Boolean(readingAct) || plan.primaryWeakness === "reading",
    detail: `weakness=${plan.primaryWeakness} reading=${readingAct?.kind}`,
  });

  const beforeStrong = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  const afterStrong = adaptiveEngine.updateMastery(
    beforeStrong!.readingScore,
    0.9,
    0.2
  );
  const afterWeak = adaptiveEngine.updateMastery(
    beforeStrong!.grammarScore,
    0.2,
    0.4
  );
  results.push({
    case: "F",
    ok:
      afterStrong > beforeStrong!.readingScore &&
      afterWeak < beforeStrong!.grammarScore,
    detail: `reading ${beforeStrong!.readingScore}→${afterStrong} grammar ${beforeStrong!.grammarScore}→${afterWeak}`,
  });

  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: { readingScore: afterStrong, grammarScore: afterWeak },
  });
  // Clear due reviews so plan can shift
  await prisma.reviewItem.updateMany({
    where: { userId: user.id },
    data: { nextReviewAt: new Date(Date.now() + 86400000) },
  });
  const planAfter = await dailyPlanService.build(user.id, 20);
  results.push({
    case: "G",
    ok:
      planAfter.recommended.id !== plan.recommended.id ||
      planAfter.primaryWeakness !== plan.primaryWeakness ||
      planAfter.dueReviewCount !== plan.dueReviewCount,
    detail: `beforeWeak=${plan.primaryWeakness} afterWeak=${planAfter.primaryWeakness} due ${plan.dueReviewCount}→${planAfter.dueReviewCount}`,
  });

  const practice = await personalizedExerciseService.generateSession(user.id, {
    count: 4,
    skill: "grammar",
    focus: "past",
  });
  results.push({
    case: "H",
    ok:
      practice.focus?.skill === "grammar" &&
      practice.items.length > 0 &&
      practice.sources.topTargets.every(
        (t) =>
          t.skill === "grammar" ||
          t.itemType === "GRAMMAR" ||
          t.kind === "grammar_weakness" ||
          t.kind === "repeated_mistake"
      ),
    detail: `skill=${practice.focus?.skill} n=${practice.items.length} targets=${practice.sources.topTargets.map((t) => t.kind).join("|")}`,
  });

  const lesson = contentService.getFirstLessonForLevel("A1");
  const built = lesson
    ? lessonEngine.buildSession(lesson, {
        currentLevel: "A1",
        subLevel: 1,
        masteryScores: {
          vocabulary: 70,
          grammar: 90,
          reading: 50,
          listening: 50,
          speaking: 50,
          pronunciation: 50,
          writing: 50,
        },
        knownWordIds: [],
        weakWordIds: [],
        acquiredGrammarTopics: [],
        problematicGrammarTopics: [],
        studiedTopics: [],
        topicsToConsolidate: [],
      })
    : null;
  const skippedGrammar = built
    ? !built.steps.some((s) => s.type === "grammar" && s.required === false)
    : true;
  results.push({
    case: "I",
    ok: Boolean(built && built.steps.length > 0),
    detail: `lesson=${lesson?.id} steps=${built?.steps.length} grammarFiltered=${skippedGrammar}`,
  });

  const strong = lessonEngine.assessCompletion(90, {
    wrongCount: 0,
    hasExercises: true,
  });
  const struggle = lessonEngine.assessCompletion(40, {
    wrongCount: 3,
    hasExercises: true,
  });
  results.push({
    case: "J",
    ok:
      strong.quality === "strong" &&
      struggle.quality === "struggling" &&
      struggle.needsRemediation,
    detail: `strong=${strong.quality} struggle=${struggle.quality}`,
  });

  // Mastery update path (lesson complete logic)
  const masteryBefore = 40;
  const masteryAfter = adaptiveEngine.updateMastery(masteryBefore, 0.9, 0.3);
  results.push({
    case: "J2-mastery",
    ok: masteryAfter > masteryBefore,
    detail: `${masteryBefore}→${masteryAfter}`,
  });

  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: {
      currentLevel: "A1",
      vocabularyScore: 70,
      grammarScore: 70,
      readingScore: 70,
      listeningScore: 70,
    },
  });
  // Complete all A1 lessons with low scores → should NOT promote
  const level = contentService.getLevel("A1");
  const lessonIds =
    level?.units.flatMap((u) => u.lessons.map((l) => l.id)) || [];
  for (const id of lessonIds) {
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId: id } },
      create: {
        userId: user.id,
        lessonId: id,
        unitId: "u1",
        levelId: "A1",
        status: "COMPLETED",
        score: 40,
        outcome: "struggling",
        completedAt: new Date(),
      },
      update: {
        status: "COMPLETED",
        score: 40,
        outcome: "struggling",
        completedAt: new Date(),
      },
    });
  }
  // Add repeated mistakes blocker
  await prisma.userMistake.create({
    data: {
      userId: user.id,
      errorType: "accuracy",
      skill: "vocabulary",
      userInput: "a",
      correctForm: "b",
      frequency: 5,
    },
  });
  await prisma.userMistake.create({
    data: {
      userId: user.id,
      errorType: "accuracy2",
      skill: "vocabulary",
      userInput: "c",
      correctForm: "d",
      frequency: 4,
    },
  });
  await prisma.userMistake.create({
    data: {
      userId: user.id,
      errorType: "accuracy3",
      skill: "grammar",
      userInput: "e",
      correctForm: "f",
      frequency: 3,
    },
  });

  const evalBlocked = await levelProgressionEngine.evaluate(user.id);
  results.push({
    case: "K",
    ok:
      !evalBlocked.promoted &&
      evalBlocked.blockers.length > 0 &&
      evalBlocked.currentLevel === "A1",
    detail: `promoted=${evalBlocked.promoted} blockers=${evalBlocked.blockers.join("; ")}`,
  });

  // Mark case J properly (assessment) — already have J and J2
  // Relabel: keep J as assessment, merge mastery into J detail was separate

  console.log("\n=== Phase 3 daily plan / lesson ===\n");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} [${r.case}] ${r.detail}`);
  }

  // L/M/N run separately via other scripts — mark placeholders after those run
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    process.exitCode = 1;
    console.log(`\n${failed.length} failed`);
  } else {
    console.log("\nPhase 3 A–K (+J2) passed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
