/**
 * FASE P1.1 — Structural path coherence (guest isolation, Free assessment cap, promotion threshold).
 * Run: npx tsx scripts/phase-p1-1-coherence-test.ts
 */
import { PrismaClient } from "@prisma/client";
import { clampAssessmentLevelForPlan } from "../src/lib/assessmentPlacement";
import { FREE_MAX_CONTENT_LEVEL } from "../src/lib/contentAccess";
import { createGuestUser, isGuestEmail } from "../src/lib/guestAccess";
import { LEVEL_PROGRESSION_THRESHOLDS } from "../src/lib/levelProgressionThresholds";
import { levelProgressionEngine } from "../src/services/learning/LevelProgressionEngine";
import { subscriptionService } from "../src/services/subscription/SubscriptionService";

const prisma = new PrismaClient();

type Result = { case: string; ok: boolean; detail: string };

async function ensureUser(
  email: string,
  opts: { premium: boolean; level?: string }
) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: "test",
        name: "P1.1 Test",
        profile: {
          create: {
            onboardingDone: true,
            assessmentDone: true,
            perceivedLevel: "a2",
            dailyMinutes: 15,
          },
        },
        progress: { create: {} },
        learningProfile: {
          create: {
            currentLevel: opts.level || "ZERO",
            subLevel: 0.1,
            vocabularyScore: 50,
            grammarScore: 50,
            readingScore: 50,
            listeningScore: 50,
          },
        },
        subscription: {
          create: {
            plan: opts.premium ? "PREMIUM" : "FREE",
            status: "ACTIVE",
            provider: "local",
            expiresAt: opts.premium
              ? new Date(Date.now() + 30 * 86400000)
              : null,
          },
        },
      },
    });
  }
  if (opts.premium) {
    await subscriptionService.upgradeToPremium(user.id, 30);
  } else {
    await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        plan: "FREE",
        status: "ACTIVE",
        provider: "local",
      },
      update: { plan: "FREE", status: "ACTIVE", expiresAt: null },
    });
  }
  return user;
}

async function main() {
  const results: Result[] = [];

  // --- A: Two guests are distinct users ---
  const g1 = await createGuestUser();
  const g2 = await createGuestUser();
  results.push({
    case: "A",
    ok:
      g1.id !== g2.id &&
      g1.email !== g2.email &&
      isGuestEmail(g1.email) &&
      isGuestEmail(g2.email),
    detail: `ids=${g1.id.slice(0, 8)}/${g2.id.slice(0, 8)} emails=${g1.email},${g2.email}`,
  });

  // --- B: Guest data isolation (progress on g1 does not touch g2) ---
  await prisma.userProgress.update({
    where: { userId: g1.id },
    data: { xp: 999, lessonsCompleted: 7 },
  });
  const g2Progress = await prisma.userProgress.findUniqueOrThrow({
    where: { userId: g2.id },
  });
  results.push({
    case: "B",
    ok: g2Progress.xp === 0 && g2Progress.lessonsCompleted === 0,
    detail: `g2 xp=${g2Progress.xp} lessons=${g2Progress.lessonsCompleted}`,
  });

  // --- C: Guest starts FREE + ZERO ---
  const g1Sub = await subscriptionService.getForUser(g1.id);
  const g1Lp = await prisma.learningProfile.findUniqueOrThrow({
    where: { userId: g1.id },
  });
  results.push({
    case: "C",
    ok:
      !g1Sub.isPremium &&
      g1Lp.currentLevel === "ZERO" &&
      g1Sub.plan === "FREE",
    detail: `premium=${g1Sub.isPremium} level=${g1Lp.currentLevel}`,
  });

  // --- D: Free assessment clamp — raw A2 → A1 ---
  const freeClamped = clampAssessmentLevelForPlan(
    { level: "A2", subLevel: 2.1 },
    false
  );
  results.push({
    case: "D",
    ok:
      freeClamped.level === FREE_MAX_CONTENT_LEVEL &&
      freeClamped.level === "A1" &&
      freeClamped.subLevel >= 1.3,
    detail: `level=${freeClamped.level} sub=${freeClamped.subLevel}`,
  });

  // --- E: Free assessment keeps ZERO / A1 ---
  const freeZero = clampAssessmentLevelForPlan(
    { level: "ZERO", subLevel: 0.1 },
    false
  );
  const freeA1 = clampAssessmentLevelForPlan(
    { level: "A1", subLevel: 1.1 },
    false
  );
  results.push({
    case: "E",
    ok: freeZero.level === "ZERO" && freeA1.level === "A1",
    detail: `zero=${freeZero.level} a1=${freeA1.level}`,
  });

  // --- F: Premium assessment may stay A2 ---
  const premiumA2 = clampAssessmentLevelForPlan(
    { level: "A2", subLevel: 2.2 },
    true
  );
  results.push({
    case: "F",
    ok: premiumA2.level === "A2" && premiumA2.subLevel === 2.2,
    detail: `level=${premiumA2.level} sub=${premiumA2.subLevel}`,
  });

  // --- G: Persist Free assessment path does not write A2 ---
  const freeUser = await ensureUser("phase-p1-1-free@test.local", {
    premium: false,
  });
  const freePersist = clampAssessmentLevelForPlan(
    { level: "A2", subLevel: 2.1 },
    false
  );
  await prisma.learningProfile.update({
    where: { userId: freeUser.id },
    data: {
      currentLevel: freePersist.level,
      subLevel: freePersist.subLevel,
    },
  });
  const freeAfter = await prisma.learningProfile.findUniqueOrThrow({
    where: { userId: freeUser.id },
  });
  results.push({
    case: "G",
    ok: freeAfter.currentLevel === "A1",
    detail: `currentLevel=${freeAfter.currentLevel}`,
  });

  // --- H: Threshold single source = 65 ---
  results.push({
    case: "H",
    ok:
      LEVEL_PROGRESSION_THRESHOLDS.masteryMin === 65 &&
      levelProgressionEngine.getThresholds().masteryMin ===
        LEVEL_PROGRESSION_THRESHOLDS.masteryMin,
    detail: `masteryMin=${LEVEL_PROGRESSION_THRESHOLDS.masteryMin}`,
  });

  // --- I: getStatus readyToPromote uses engine blockers (not 55) ---
  const statusUser = await ensureUser("phase-p1-1-status@test.local", {
    premium: false,
    level: "A1",
  });
  await prisma.learningProfile.update({
    where: { userId: statusUser.id },
    data: {
      currentLevel: "A1",
      vocabularyScore: 60,
      grammarScore: 60,
      readingScore: 60,
      listeningScore: 60,
    },
  });
  // Avg 60 < 65 → not ready even if lessons complete ratio were 1
  const status = await levelProgressionEngine.getStatus(statusUser.id);
  const masteryBlock = status.blockers.some((b) =>
    b.includes(`${LEVEL_PROGRESSION_THRESHOLDS.masteryMin}%`)
  );
  results.push({
    case: "I",
    ok:
      status.averageMastery === 60 &&
      status.readyToPromote === false &&
      masteryBlock &&
      !status.promoted,
    detail: `avg=${status.averageMastery} ready=${status.readyToPromote} blockers=${status.blockers.join(";")}`,
  });

  // --- J: getStatus does not promote / mutate level ---
  await prisma.learningProfile.update({
    where: { userId: statusUser.id },
    data: { currentLevel: "A1", subLevel: 1.2 },
  });
  await levelProgressionEngine.getStatus(statusUser.id);
  const afterStatus = await prisma.learningProfile.findUniqueOrThrow({
    where: { userId: statusUser.id },
  });
  results.push({
    case: "J",
    ok:
      afterStatus.currentLevel === "A1" &&
      afterStatus.subLevel === 1.2,
    detail: `level=${afterStatus.currentLevel} sub=${afterStatus.subLevel}`,
  });

  console.log("\n=== FASE P1.1 COHERENCE TEST REPORT ===\n");
  let pass = 0;
  for (const r of results) {
    const statusLine = r.ok ? "PASS" : "FAIL";
    if (r.ok) pass++;
    console.log(`[${statusLine}] ${r.case}: ${r.detail}`);
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
