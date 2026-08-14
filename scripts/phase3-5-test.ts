/**
 * Phase 3.5 — pronunciation evaluated flag + lesson comprehension flow (A–J).
 * Run: npx tsx scripts/phase3-5-test.ts
 */
import { PrismaClient } from "@prisma/client";
import { contentService } from "../src/services/content/ContentService";
import { lessonEngine } from "../src/services/learning/LessonEngine";
import { exerciseEngine } from "../src/services/learning/ExerciseEngine";
import { comprehensionToExercise } from "../src/lib/comprehension";
import { getWeakSkills } from "../src/lib/learningProfile";

const prisma = new PrismaClient();

async function ensureUser(email: string, lp?: Record<string, unknown>) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: "test",
        name: "Phase35 Test",
        profile: {
          create: { onboardingDone: true, assessmentDone: true, dailyMinutes: 20 },
        },
        progress: { create: {} },
        learningProfile: {
          create: {
            currentLevel: "A1",
            vocabularyScore: 50,
            grammarScore: 50,
            readingScore: 50,
            listeningScore: 70,
            speakingScore: 60,
            writingScore: 55,
            pronunciationScore: 0,
            pronunciationEvaluated: false,
            ...lp,
          },
        },
      },
    });
  } else if (lp) {
    await prisma.learningProfile.update({
      where: { userId: user.id },
      data: lp,
    });
  }
  return user;
}

async function runRegression(name: string, script: string) {
  const { execSync } = await import("node:child_process");
  try {
    execSync(`npx tsx ${script}`, {
      cwd: process.cwd(),
      stdio: "pipe",
      encoding: "utf8",
    });
    return { ok: true, detail: "all PASS" };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    const out = `${err.stdout || ""}${err.stderr || ""}`.slice(-400);
    return { ok: false, detail: out || String(e) };
  }
}

async function main() {
  const results: Array<{ case: string; ok: boolean; detail: string }> = [];
  const user = await ensureUser("phase3-5@test.local");

  await prisma.personalizedExerciseAttempt.deleteMany({ where: { userId: user.id } });
  await prisma.readingComprehensionAttempt.deleteMany({ where: { userId: user.id } });
  await prisma.reviewItem.deleteMany({ where: { userId: user.id } });
  await prisma.userMistake.deleteMany({ where: { userId: user.id } });
  await prisma.lessonProgress.deleteMany({ where: { userId: user.id } });

  const { personalizedExerciseSources } = await import(
    "../src/services/learning/PersonalizedExerciseSourceService"
  );
  const { adaptiveEngine } = await import(
    "../src/services/learning/AdaptiveEngine"
  );

  // --- A: unevaluated pronunciation → not a weakness ---
  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: {
      vocabularyScore: 40,
      grammarScore: 45,
      readingScore: 42,
      listeningScore: 55,
      speakingScore: 50,
      writingScore: 48,
      pronunciationScore: 0,
      pronunciationEvaluated: false,
    },
  });
  let sources = await personalizedExerciseSources.collect(user.id);
  const weakHasUnevaluatedPron = sources.weakestSkills.includes("pronunciation");
  const skillWeakTargets = sources.targets.filter(
    (t) => t.kind === "skill_weakness" && t.skill === "pronunciation"
  );
  results.push({
    case: "A",
    ok: !weakHasUnevaluatedPron && skillWeakTargets.length === 0,
    detail: `weakest=${sources.weakestSkills.join(",")} pronTargets=${skillWeakTargets.length}`,
  });

  // --- B: evaluated pronunciation score 0 → weakness ---
  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: { pronunciationScore: 0, pronunciationEvaluated: true },
  });
  sources = await personalizedExerciseSources.collect(user.id);
  const weakHasEvaluatedPron = sources.weakestSkills.includes("pronunciation");
  results.push({
    case: "B",
    ok: weakHasEvaluatedPron,
    detail: `weakest=${sources.weakestSkills.join(",")}`,
  });

  // --- C: reading lesson injects comprehension step ---
  const lesson = contentService.getLesson("a1-u1-l1");
  const session = lesson ? lessonEngine.buildSession(lesson) : null;
  const compStep = session?.steps.find((s) => s.type === "comprehension");
  const readingIdx = session?.steps.findIndex((s) => s.type === "reading") ?? -1;
  const compAfterReading =
    compStep != null &&
    readingIdx >= 0 &&
    session!.steps[readingIdx + 1]?.type === "comprehension" &&
    compStep.contentRef === "a1-meeting-someone";
  results.push({
    case: "C",
    ok: Boolean(compAfterReading),
    detail: compStep
      ? `step=${compStep.id} ref=${compStep.contentRef} afterReading=${readingIdx + 1}`
      : "no comprehension step",
  });

  // --- D–F: comprehension complete in lesson context ---
  const set = contentService.getComprehension("a1-meeting-someone");
  const exercises = (set?.questions || []).map(comprehensionToExercise);
  const wrongAttempt = exercises.map((ex) => ({
    exerciseId: ex.id,
    userAnswer: "WRONG",
  }));
  const { reviewQueue: rq } = await import(
    "../src/services/learning/ReviewQueueService"
  );

  await prisma.userMistake.deleteMany({ where: { userId: user.id } });
  await prisma.reviewItem.deleteMany({ where: { userId: user.id } });

  const evalResult = exerciseEngine.evaluateSession(exercises, wrongAttempt);
  for (const evaluation of evalResult.evaluations) {
    if (evaluation.correct) continue;
    const question = set!.questions.find((q) => q.id === evaluation.exerciseId);
    await rq.recordMistakeAndEnqueue({
      userId: user.id,
      errorType: question?.topic || "reading_comprehension",
      skill: question?.skill || "reading",
      userInput: "WRONG",
      correctForm: String(evaluation.expected),
      context: question?.question || "a1-meeting-someone",
      lessonId: "a1-u1-l1",
      source: "reading_comprehension",
      contentRef: "a1-meeting-someone",
    });
  }

  const mistakeCount = await prisma.userMistake.count({
    where: { userId: user.id, resolved: false },
  });
  const reviewCount = await prisma.reviewItem.count({ where: { userId: user.id } });
  results.push({
    case: "D",
    ok: mistakeCount > 0 && reviewCount > 0,
    detail: `mistakes=${mistakeCount} reviews=${reviewCount}`,
  });

  const lpBefore = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  const correctAttempts = exercises.map((ex) => ({
    exerciseId: ex.id,
    userAnswer: ex.answer,
  }));
  const correctEval = exerciseEngine.evaluateSession(exercises, correctAttempts);
  const accuracy = correctEval.score / 100;
  const newReading = adaptiveEngine.updateMastery(lpBefore!.readingScore, accuracy);
  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: { readingScore: newReading },
  });
  const lpAfter = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  results.push({
    case: "E",
    ok: (lpAfter?.readingScore ?? 0) > (lpBefore?.readingScore ?? 0),
    detail: `reading ${lpBefore?.readingScore} → ${lpAfter?.readingScore}`,
  });

  const stepResults = [
    { stepId: "reading", type: "reading", score: 100, completedAt: new Date().toISOString() },
    {
      stepId: "reading-comprehension",
      type: "comprehension",
      score: correctEval.score,
      mistakes: [],
      completedAt: new Date().toISOString(),
    },
    { stepId: "exercise", type: "exercise", score: 80, completedAt: new Date().toISOString() },
  ];
  const avgScore = Math.round(
    stepResults.reduce((s, r) => s + r.score, 0) / stepResults.length
  );
  const assessment = lessonEngine.assessCompletion(avgScore, {
    wrongCount: 0,
    hasExercises: true,
  });
  results.push({
    case: "F",
    ok: assessment.score === avgScore && stepResults.some((s) => s.type === "comprehension"),
    detail: `avg=${avgScore} quality=${assessment.quality}`,
  });

  // --- G–J: regressions ---
  for (const [label, script] of [
    ["G", "scripts/phase0-review-queue-test.ts"],
    ["H", "scripts/phase1-reading-cycle-test.ts"],
    ["I", "scripts/phase2-personalized-exercises-test.ts"],
    ["J", "scripts/phase3-daily-plan-test.ts"],
  ] as const) {
    const reg = await runRegression(label, script);
    results.push({ case: label, ok: reg.ok, detail: reg.detail });
  }

  // Helper unit: getWeakSkills respects evaluated flag
  const scores = {
    vocabulary: 30,
    grammar: 35,
    reading: 32,
    listening: 60,
    speaking: 55,
    pronunciation: 0,
    writing: 50,
  };
  const withoutEval = getWeakSkills(scores, 3, { pronunciationEvaluated: false });
  const withEval = getWeakSkills(scores, 3, { pronunciationEvaluated: true });
  results.push({
    case: "A-helper",
    ok: !withoutEval.includes("pronunciation") && withEval.includes("pronunciation"),
    detail: `without=${withoutEval.join(",")} with=${withEval.join(",")}`,
  });

  console.log("\n=== PHASE 3.5 TEST REPORT ===\n");
  let pass = 0;
  for (const r of results) {
    const status = r.ok ? "PASS" : "FAIL";
    if (r.ok) pass++;
    console.log(`[${status}] ${r.case}: ${r.detail}`);
  }
  console.log(`\n${pass}/${results.length} passed\n`);
  await prisma.$disconnect();
  if (pass < results.length) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
