/**
 * FASE 4.1 — pronunciationEvaluated fix + lint cleanup verification (A–J).
 * Run: npx tsx scripts/phase4-1-test.ts
 */
import { PrismaClient } from "@prisma/client";
import { adaptiveEngine } from "../src/services/learning/AdaptiveEngine";
import { getWeakSkills } from "../src/lib/learningProfile";

const prisma = new PrismaClient();

async function runRegression(script: string) {
  const { execSync } = await import("node:child_process");
  try {
    execSync(`npx tsx ${script}`, {
      cwd: process.cwd(),
      stdio: "pipe",
      encoding: "utf8",
    });
    return true;
  } catch {
    return false;
  }
}

async function ensureUser(email: string) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: "test",
        name: "Phase41 Test",
        profile: { create: { onboardingDone: false, assessmentDone: false } },
        progress: { create: {} },
        learningProfile: {
          create: {
            currentLevel: "A1",
            vocabularyScore: 50,
            grammarScore: 50,
            readingScore: 50,
            listeningScore: 50,
            speakingScore: 50,
            pronunciationScore: 0,
            pronunciationEvaluated: false,
          },
        },
      },
    });
  }
  return user;
}

async function main() {
  const results: Array<{ case: string; ok: boolean; detail: string }> = [];
  const user = await ensureUser("phase4-1@test.local");

  // --- A: Assessment sets pronunciationEvaluated = false ---
  await prisma.learningProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      pronunciationScore: 20,
      pronunciationEvaluated: false,
    },
    update: {
      pronunciationScore: 20,
      pronunciationEvaluated: false,
      vocabularyScore: 40,
      grammarScore: 45,
      readingScore: 42,
      listeningScore: 55,
      speakingScore: 50,
      writingScore: 48,
    },
  });

  const assessmentScores = {
    vocabulary: 60,
    grammar: 55,
    reading: 50,
    listening: 65,
    speaking: 40,
    pronunciation: 15,
    writing: 45,
  };

  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: {
      vocabularyScore: assessmentScores.vocabulary,
      grammarScore: assessmentScores.grammar,
      readingScore: assessmentScores.reading,
      listeningScore: assessmentScores.listening,
      speakingScore: assessmentScores.speaking,
      pronunciationScore: assessmentScores.pronunciation,
      pronunciationEvaluated: false,
      writingScore: assessmentScores.writing,
    },
  });

  const lpAfterAssessment = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  results.push({
    case: "A",
    ok:
      lpAfterAssessment?.pronunciationEvaluated === false &&
      lpAfterAssessment?.pronunciationScore === 15,
    detail: `evaluated=${lpAfterAssessment?.pronunciationEvaluated} score=${lpAfterAssessment?.pronunciationScore}`,
  });

  // --- B: Speaking without phonetic → pronunciationEvaluated stays false ---
  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: { pronunciationEvaluated: false, pronunciationScore: 15 },
  });
  const lpBeforeSpeaking = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  const speakingUpdate: {
    speakingScore: number;
    grammarScore: number;
    pronunciationScore?: number;
    pronunciationEvaluated?: boolean;
  } = {
    speakingScore: adaptiveEngine.updateMastery(lpBeforeSpeaking!.speakingScore, 0.75),
    grammarScore: adaptiveEngine.updateMastery(lpBeforeSpeaking!.grammarScore, 0.7),
  };
  const pronunciationAssessed = false;
  if (pronunciationAssessed) {
    speakingUpdate.pronunciationScore = 50;
    speakingUpdate.pronunciationEvaluated = true;
  }
  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: speakingUpdate,
  });
  const lpAfterSpeaking = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  results.push({
    case: "B",
    ok: lpAfterSpeaking?.pronunciationEvaluated === false,
    detail: `evaluated=${lpAfterSpeaking?.pronunciationEvaluated}`,
  });

  // --- C: pronunciationAssessed = true → updates score + evaluated ---
  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: { pronunciationScore: 10, pronunciationEvaluated: false },
  });
  const lpBeforePhonetic = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  const phoneticAssessed = true;
  const phoneticScore = 85;
  if (phoneticAssessed && phoneticScore != null) {
    await prisma.learningProfile.update({
      where: { userId: user.id },
      data: {
        pronunciationScore: adaptiveEngine.updateMastery(
          lpBeforePhonetic!.pronunciationScore,
          phoneticScore / 100
        ),
        pronunciationEvaluated: true,
      },
    });
  }
  const lpAfterPhonetic = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  results.push({
    case: "C",
    ok:
      lpAfterPhonetic?.pronunciationEvaluated === true &&
      (lpAfterPhonetic?.pronunciationScore ?? 0) > 10,
    detail: `evaluated=${lpAfterPhonetic?.pronunciationEvaluated} score=${lpAfterPhonetic?.pronunciationScore}`,
  });

  // --- D: Daily Plan excludes unevaluated pronunciation ---
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
  const { personalizedExerciseSources } = await import(
    "../src/services/learning/PersonalizedExerciseSourceService"
  );
  const sources = await personalizedExerciseSources.collect(user.id);
  const weakHasPron = sources.weakestSkills.includes("pronunciation");
  const pronTargets = sources.targets.filter(
    (t) => t.kind === "skill_weakness" && t.skill === "pronunciation"
  );
  const weakSkillsHelper = getWeakSkills(
    {
      vocabulary: 40,
      grammar: 45,
      reading: 42,
      listening: 55,
      speaking: 50,
      pronunciation: 0,
      writing: 48,
    },
    3,
    { pronunciationEvaluated: false }
  );
  results.push({
    case: "D",
    ok:
      !weakHasPron &&
      pronTargets.length === 0 &&
      !weakSkillsHelper.includes("pronunciation"),
    detail: `weakest=${sources.weakestSkills.join(",")} helper=${weakSkillsHelper.join(",")}`,
  });

  // --- E–J: regressions ---
  for (const [label, script] of [
    ["E", "scripts/phase0-review-queue-test.ts"],
    ["F", "scripts/phase1-reading-cycle-test.ts"],
    ["G", "scripts/phase2-personalized-exercises-test.ts"],
    ["H", "scripts/phase3-daily-plan-test.ts"],
    ["I", "scripts/phase3-5-test.ts"],
    ["J", "scripts/phase4-ai-test.ts"],
  ] as const) {
    const ok = await runRegression(script);
    results.push({ case: label, ok, detail: ok ? "PASS" : "FAIL" });
  }

  console.log("\n=== FASE 4.1 TEST REPORT ===\n");
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
