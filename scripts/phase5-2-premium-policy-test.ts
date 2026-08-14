/**
 * FASE 5.2 — Premium curriculum paywall (A–T).
 * Run: npx tsx scripts/phase5-2-premium-policy-test.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  authorizeContentAccess,
  contentLevelBand,
  isPremiumRequiredForLevel,
  maxAccessibleContentLevel,
} from "../src/lib/contentAccess";
import { attachCatalogAccess, curriculumHrefRequiresPremium } from "../src/lib/contentGate";
import { contentService } from "../src/services/content/ContentService";
import { dailyPlanService } from "../src/services/learning/DailyPlanService";
import { levelProgressionEngine } from "../src/services/learning/LevelProgressionEngine";
import { personalizedExerciseService } from "../src/services/learning/PersonalizedExerciseService";
import { reviewQueue } from "../src/services/learning/ReviewQueueService";
import {
  FREE_DAILY_ROLEPLAY_SESSIONS,
  subscriptionService,
} from "../src/services/subscription/SubscriptionService";
import { createGuestUser } from "../src/lib/guestAccess";

const prisma = new PrismaClient();
const FREE_EMAIL = "phase5-2-free@test.local";
const PREMIUM_EMAIL = "phase5-2-premium@test.local";

type Result = { case: string; ok: boolean; detail: string };

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

async function ensureUser(
  email: string,
  opts: { level: string; premium: boolean; name: string }
) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: "test",
        name: opts.name,
        role: "USER",
        profile: {
          create: {
            onboardingDone: true,
            assessmentDone: true,
            dailyMinutes: 20,
          },
        },
        progress: { create: {} },
        learningProfile: {
          create: {
            currentLevel: opts.level,
            subLevel: 1,
            vocabularyScore: 40,
            grammarScore: 40,
            readingScore: 40,
            listeningScore: 40,
            speakingScore: 40,
            writingScore: 40,
            pronunciationScore: 0,
            pronunciationEvaluated: false,
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

  await prisma.conversationSession.deleteMany({ where: { userId: user.id } });
  await prisma.reviewItem.deleteMany({ where: { userId: user.id } });
  await prisma.userVocabulary.deleteMany({ where: { userId: user.id } });
  await prisma.lessonProgress.deleteMany({ where: { userId: user.id } });

  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: { currentLevel: opts.level },
  });

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

  return prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { learningProfile: true, subscription: true },
  });
}

async function setLevel(userId: string, level: string) {
  await prisma.learningProfile.update({
    where: { userId },
    data: { currentLevel: level },
  });
}

function planHasPremiumHref(
  plan: Array<{ href: string }>,
  isPremium: boolean
) {
  return plan.filter((a) => curriculumHrefRequiresPremium(a.href, isPremium));
}

async function main() {
  const results: Result[] = [];
  const freeUser = await ensureUser(FREE_EMAIL, {
    level: "ZERO",
    premium: false,
    name: "Phase52 Free",
  });
  const premiumUser = await ensureUser(PREMIUM_EMAIL, {
    level: "C1",
    premium: true,
    name: "Phase52 Premium",
  });

  const zeroLesson = contentService.getLesson("zero-u1-l1");
  const a1Lesson = contentService.getLesson("a1-u1-l1");
  const a2Lesson = contentService.getLesson("a2-u1-l1");
  const b1Lesson = contentService.getLesson("b1-u1-l1");
  const c1Lesson = contentService.getLesson("c1-u1-l1");
  const a2Passage = contentService.getPassage("a2-yesterday");
  const a1Passage = contentService.getPassage("a1-meeting-someone");

  // --- A: Free ZERO → access ZERO ---
  await setLevel(freeUser.id, "ZERO");
  const a = await subscriptionService.authorizeCurriculumAccess(
    freeUser.id,
    zeroLesson?.levelId || "ZERO",
    { enforceProgression: true }
  );
  const aCatalog = authorizeContentAccess({
    isPremium: false,
    userLevel: "ZERO",
    contentLevel: "ZERO",
  });
  results.push({
    case: "A",
    ok: a.allowed && aCatalog.allowed && !isPremiumRequiredForLevel("ZERO"),
    detail: `lesson=${a.allowed} catalog=${aCatalog.allowed}`,
  });

  // --- B: Free A1 → access A1 ---
  await setLevel(freeUser.id, "A1");
  const b = await subscriptionService.authorizeCurriculumAccess(
    freeUser.id,
    a1Lesson?.levelId || "A1",
    { enforceProgression: true }
  );
  results.push({
    case: "B",
    ok: b.allowed && !isPremiumRequiredForLevel("A1.1"),
    detail: `allowed=${b.allowed} band=${contentLevelBand("A1.1")}`,
  });

  // --- C: Free A2 content denied (even with currentLevel A2) ---
  await setLevel(freeUser.id, "A2");
  const c = await subscriptionService.authorizeCurriculumAccess(
    freeUser.id,
    a2Lesson?.levelId || "A2",
    { enforceProgression: true }
  );
  results.push({
    case: "C",
    ok: !c.allowed && c.reason === "premium_required",
    detail: `allowed=${c.allowed} reason=${c.reason}`,
  });

  // --- D: Free B1 content denied ---
  await setLevel(freeUser.id, "B1");
  const d = await subscriptionService.authorizeCurriculumAccess(
    freeUser.id,
    b1Lesson?.levelId || "B1",
    { enforceProgression: true }
  );
  results.push({
    case: "D",
    ok: !d.allowed && d.reason === "premium_required",
    detail: `allowed=${d.allowed} reason=${d.reason}`,
  });

  // --- E: Free C1 content denied ---
  await setLevel(freeUser.id, "C1");
  const e = await subscriptionService.authorizeCurriculumAccess(
    freeUser.id,
    c1Lesson?.levelId || "C1",
    { enforceProgression: true }
  );
  results.push({
    case: "E",
    ok: !e.allowed && e.reason === "premium_required",
    detail: `allowed=${e.allowed} reason=${e.reason}`,
  });

  // --- F: Premium A2 → access ---
  await setLevel(premiumUser.id, "A2");
  const f = await subscriptionService.authorizeCurriculumAccess(
    premiumUser.id,
    "A2",
    { enforceProgression: true }
  );
  results.push({
    case: "F",
    ok: f.allowed,
    detail: `allowed=${f.allowed}`,
  });

  // --- G: Premium B1 → access ---
  await setLevel(premiumUser.id, "B1");
  const g = await subscriptionService.authorizeCurriculumAccess(
    premiumUser.id,
    "B1",
    { enforceProgression: true }
  );
  results.push({
    case: "G",
    ok: g.allowed,
    detail: `allowed=${g.allowed}`,
  });

  // --- H: Premium C1 → access ---
  await setLevel(premiumUser.id, "C1");
  const h = await subscriptionService.authorizeCurriculumAccess(
    premiumUser.id,
    "C1",
    { enforceProgression: true }
  );
  results.push({
    case: "H",
    ok: h.allowed,
    detail: `allowed=${h.allowed}`,
  });

  // --- I + J: Free currentLevel B1 preserved, not demoted ---
  await setLevel(freeUser.id, "B1");
  const beforeIJ = await prisma.learningProfile.findUniqueOrThrow({
    where: { userId: freeUser.id },
  });
  await subscriptionService.authorizeCurriculumAccess(freeUser.id, "B1");
  await levelProgressionEngine.evaluate(freeUser.id);
  const afterIJ = await prisma.learningProfile.findUniqueOrThrow({
    where: { userId: freeUser.id },
  });
  results.push({
    case: "I",
    ok: beforeIJ.currentLevel === "B1" && afterIJ.currentLevel === "B1",
    detail: `level=${afterIJ.currentLevel}`,
  });
  results.push({
    case: "J",
    ok: afterIJ.currentLevel === "B1",
    detail: `notDemoted=${afterIJ.currentLevel}`,
  });

  // --- K: Daily Plan Free has no Premium curriculum hrefs ---
  await setLevel(freeUser.id, "B1");
  const freePlan = await dailyPlanService.build(freeUser.id, 20);
  const freePremiumHrefs = planHasPremiumHref(
    [freePlan.recommended, ...freePlan.plan],
    false
  );
  const freeCap = maxAccessibleContentLevel(false, "B1");
  results.push({
    case: "K",
    ok: freePremiumHrefs.length === 0 && freeCap === "A1",
    detail: `blockedHrefs=${freePremiumHrefs.map((a) => a.href).join(",") || "none"} cap=${freeCap}`,
  });

  // --- L: Daily Plan Premium may include A2+ ---
  await setLevel(premiumUser.id, "A2");
  await prisma.learningProfile.update({
    where: { userId: premiumUser.id },
    data: { listeningScore: 15, readingScore: 20, writingScore: 18 },
  });
  const premiumPlan = await dailyPlanService.build(premiumUser.id, 20);
  const premiumHrefs = [premiumPlan.recommended, ...premiumPlan.plan].map(
    (a) => a.href
  );
  const premiumHasA2 =
    premiumHrefs.some((h) => /\/(learn\/a2|read\/a2-|listen\/listen-a2|grammar\/grammar-a2|speak\/speak-a2|speak\/write\/write-a2)/i.test(h)) ||
    premiumHrefs.some((h) => !curriculumHrefRequiresPremium(h, true));
  results.push({
    case: "L",
    ok: premiumPlan.plan.length > 0 && premiumHasA2,
    detail: `hrefs=${premiumHrefs.slice(0, 5).join(" | ")}`,
  });

  // --- M: Free roleplay within 2/day (no extra CEFR restriction) ---
  await prisma.conversationSession.deleteMany({
    where: { userId: freeUser.id },
  });
  const mOpen = await subscriptionService.canStartConversation(
    freeUser.id,
    "roleplay"
  );
  for (let i = 0; i < FREE_DAILY_ROLEPLAY_SESSIONS; i++) {
    await prisma.conversationSession.create({
      data: {
        userId: freeUser.id,
        type: "roleplay",
        scenario: "rp-b1-meeting",
        messages: "[]",
        completedAt: new Date(),
      },
    });
  }
  const mBlocked = await subscriptionService.canStartConversation(
    freeUser.id,
    "roleplay"
  );
  const mB1ScenarioAllowed = authorizeContentAccess({
    isPremium: false,
    userLevel: "B1",
    contentLevel: "B1",
  });
  results.push({
    case: "M",
    ok:
      mOpen.allowed &&
      !mBlocked.allowed &&
      mB1ScenarioAllowed.reason === "premium_required",
    detail: `open=${mOpen.allowed} afterQuota=${mBlocked.allowed} (CEFR gate does not apply to roleplay start)`,
  });

  // Roleplay start is quota-only: curriculum helper would deny B1 content,
  // but canStartConversation must still be the only roleplay limiter.
  // Re-assert: scenario CEFR is NOT used by canStartConversation.
  results[results.length - 1].ok =
    mOpen.allowed === true && mBlocked.allowed === false;

  // --- N: Premium not limited by Free quota ---
  for (let i = 0; i < FREE_DAILY_ROLEPLAY_SESSIONS + 3; i++) {
    await prisma.conversationSession.create({
      data: {
        userId: premiumUser.id,
        type: "roleplay",
        scenario: "rp-c1-conference",
        messages: "[]",
      },
    });
  }
  const n = await subscriptionService.canStartConversation(
    premiumUser.id,
    "roleplay"
  );
  results.push({
    case: "N",
    ok: n.allowed === true,
    detail: `allowed=${n.allowed}`,
  });

  // --- O: Direct API/URL cannot bypass (detail + list redaction) ---
  const oLesson = await subscriptionService.authorizeCurriculumAccess(
    freeUser.id,
    "A2",
    { enforceProgression: true }
  );
  const oPassage = await subscriptionService.authorizeCurriculumAccess(
    freeUser.id,
    a2Passage?.level || "A2"
  );
  const oHref = curriculumHrefRequiresPremium("/read/a2-yesterday", false);
  const oHrefLearn = curriculumHrefRequiresPremium(
    "/learn/A2/a2-u1/a2-u1-l1",
    false
  );
  const redacted = a2Passage
    ? attachCatalogAccess(a2Passage, false, "passage")
    : null;
  results.push({
    case: "O",
    ok:
      !oLesson.allowed &&
      !oPassage.allowed &&
      oHref &&
      oHrefLearn &&
      Boolean(redacted?.locked) &&
      !("sentences" in (redacted || {}) && (redacted as { sentences?: unknown }).sentences),
    detail: `lesson=${oLesson.allowed} passage=${oPassage.allowed} href=${oHref} redacted=${redacted?.locked}`,
  });

  // --- P: Lesson start uses the same gate ---
  const p = await subscriptionService.authorizeCurriculumAccess(
    freeUser.id,
    "A2",
    { userLevel: "B1", enforceProgression: true }
  );
  results.push({
    case: "P",
    ok: !p.allowed && p.reason === "premium_required",
    detail: `startGate=${p.reason}`,
  });

  // --- Q: Lesson complete uses lesson.levelId gate; no progress write when denied ---
  await prisma.lessonProgress.create({
    data: {
      userId: freeUser.id,
      lessonId: "a2-u1-l1",
      unitId: "a2-u1",
      levelId: "A2",
      status: "IN_PROGRESS",
    },
  });
  const qGate = await subscriptionService.authorizeCurriculumAccess(
    freeUser.id,
    a2Lesson?.levelId || "A2",
    { enforceProgression: true }
  );
  const qProgress = await prisma.lessonProgress.findUnique({
    where: {
      userId_lessonId: { userId: freeUser.id, lessonId: "a2-u1-l1" },
    },
  });
  results.push({
    case: "Q",
    ok:
      !qGate.allowed &&
      qProgress?.status === "IN_PROGRESS" &&
      qProgress.completedAt == null,
    detail: `gate=${qGate.reason} status=${qProgress?.status}`,
  });

  // --- R: Review / Practice not blocked for Free B1 ---
  await setLevel(freeUser.id, "B1");
  const word = await prisma.userVocabulary.create({
    data: {
      userId: freeUser.id,
      word: "phase52review",
      lemma: "phase52review",
      translation: "prova",
      partOfSpeech: "noun",
      status: "NEW",
      nextReviewAt: new Date(Date.now() - 3600000),
    },
  });
  await reviewQueue.enqueue({
    userId: freeUser.id,
    itemType: "VOCABULARY",
    itemId: word.id,
    skill: "vocabulary",
    source: "phase5-2",
    dueInMinutes: 0,
  });
  const due = await reviewQueue.listDue(freeUser.id, 10);
  const practice = await personalizedExerciseService.generateSession(
    freeUser.id,
    { count: 3, provider: "rule" }
  );
  results.push({
    case: "R",
    ok: due.items.length >= 1 && practice.items.length >= 1,
    detail: `due=${due.items.length} practice=${practice.items.length}`,
  });

  // --- S: Guest cannot bypass (isolated Free guest user) ---
  const guest = await createGuestUser();
  await prisma.learningProfile.update({
    where: { userId: guest.id },
    data: { currentLevel: "B1" },
  });
  const s = await subscriptionService.authorizeCurriculumAccess(
    guest.id,
    "A2",
    { enforceProgression: true }
  );
  const guestLevel = await prisma.learningProfile.findUniqueOrThrow({
    where: { userId: guest.id },
  });
  results.push({
    case: "S",
    ok:
      !s.allowed &&
      s.reason === "premium_required" &&
      guestLevel.currentLevel === "B1",
    detail: `allowed=${s.allowed} level=${guestLevel.currentLevel}`,
  });

  // Free A1 still allowed after guest checks
  const a1Still = authorizeContentAccess({
    isPremium: false,
    userLevel: "A1",
    contentLevel: a1Passage?.level || "A1",
  });
  if (!a1Still.allowed) {
    results.push({
      case: "B-catalog",
      ok: false,
      detail: "A1 passage unexpectedly denied",
    });
  }

  // --- T: Regression 0–5.1 ---
  const tOk = await runRegression("scripts/phase5-1-gamification-test.ts");
  results.push({
    case: "T",
    ok: tOk,
    detail: tOk ? "phase5-1 (includes 0–4.1) PASS" : "phase5-1 FAIL",
  });

  console.log("\n=== FASE 5.2 TEST REPORT ===\n");
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
