/**
 * FASE 5.1 — Gamification / Subscription / Analytics / Admin validation (A–N).
 * Run: npx tsx scripts/phase5-1-gamification-test.ts
 *
 * Deterministic: uses a dedicated user and resets related rows before assertions.
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { achievementEngine } from "../src/services/gamification/AchievementEngine";
import { getAchievementCatalog } from "../src/services/gamification/achievementCatalog";
import { processGamification } from "../src/lib/gamification";
import { analyticsService } from "../src/services/analytics/AnalyticsService";
import { analyticsInsightsService } from "../src/services/analytics/AnalyticsInsightsService";
import {
  adminContentService,
  type ContentBucket,
} from "../src/services/admin/AdminContentService";
import { isAdminUser } from "../src/lib/admin";
import {
  FREE_DAILY_ROLEPLAY_SESSIONS,
  FREE_DAILY_TUTOR_SESSIONS,
  subscriptionService,
} from "../src/services/subscription/SubscriptionService";

const prisma = new PrismaClient();
const TEST_EMAIL = "phase5-1@test.local";
const ADMIN_TEST_BUCKET: ContentBucket = "writing";
const ADMIN_TEST_ID = "phase51-test-item";

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

async function wipeUser(userId: string) {
  await prisma.userAchievement.deleteMany({ where: { userId } });
  await prisma.analyticsEvent.deleteMany({ where: { userId } });
  await prisma.conversationSession.deleteMany({ where: { userId } });
  await prisma.userVocabulary.deleteMany({ where: { userId } });
  await prisma.userExpression.deleteMany({ where: { userId } });
  await prisma.reviewItem.deleteMany({ where: { userId } });
  await prisma.userMistake.deleteMany({ where: { userId } });
  await prisma.subscription.deleteMany({ where: { userId } });
  await prisma.userProgress.update({
    where: { userId },
    data: {
      xp: 0,
      streak: 0,
      longestStreak: 0,
      totalStudyMinutes: 0,
      lessonsCompleted: 0,
      wordsLearned: 0,
      lastActiveDate: null,
    },
  });
  await prisma.learningProfile.update({
    where: { userId },
    data: {
      currentLevel: "A1",
      subLevel: 1,
    },
  });
}

async function ensureUser() {
  let user = await prisma.user.findUnique({
    where: { email: TEST_EMAIL },
    include: { progress: true, learningProfile: true },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        passwordHash: "test",
        name: "Phase 5.1 Test",
        role: "USER",
        profile: {
          create: { onboardingDone: true, assessmentDone: true },
        },
        progress: { create: {} },
        learningProfile: {
          create: {
            currentLevel: "A1",
            subLevel: 1,
            vocabularyScore: 50,
            grammarScore: 50,
            readingScore: 50,
            listeningScore: 50,
            speakingScore: 50,
            writingScore: 50,
            pronunciationScore: 0,
            pronunciationEvaluated: false,
          },
        },
      },
      include: { progress: true, learningProfile: true },
    });
  }
  await wipeUser(user.id);
  return prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { progress: true, learningProfile: true },
  });
}

async function seedConversationSessions(
  userId: string,
  type: "tutor" | "roleplay",
  count: number
) {
  const now = new Date();
  for (let i = 0; i < count; i++) {
    await prisma.conversationSession.create({
      data: {
        userId,
        type,
        scenario: type === "roleplay" ? "cafe" : null,
        messages: "[]",
        startedAt: now,
        // Free quota counts completed sessions only.
        completedAt: now,
      },
    });
  }
}

function cleanupAdminTestFile() {
  const file = path.join(
    process.cwd(),
    "content",
    ADMIN_TEST_BUCKET,
    `${ADMIN_TEST_ID}.json`
  );
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

async function main() {
  const results: Result[] = [];
  const user = await ensureUser();
  const catalog = getAchievementCatalog();

  // --- A: XP assigned correctly on unlock ---
  await prisma.userProgress.update({
    where: { userId: user.id },
    data: { lessonsCompleted: 1, xp: 100 },
  });
  const beforeA = await prisma.userProgress.findUniqueOrThrow({
    where: { userId: user.id },
  });
  const unlockA = await processGamification(user.id);
  const afterA = await prisma.userProgress.findUniqueOrThrow({
    where: { userId: user.id },
  });
  const firstLesson = catalog.achievements.find((a) => a.id === "first-lesson");
  results.push({
    case: "A",
    ok:
      unlockA.newlyUnlocked.some((a) => a.id === "first-lesson") &&
      unlockA.xpGranted ===
        unlockA.newlyUnlocked.reduce((s, a) => s + a.xpReward, 0) &&
      afterA.xp === beforeA.xp + unlockA.xpGranted &&
      unlockA.xpGranted >= (firstLesson?.xpReward ?? 25),
    detail: `unlocked=${unlockA.newlyUnlocked.map((a) => a.id).join(",")} xpGranted=${unlockA.xpGranted} xp=${beforeA.xp}->${afterA.xp}`,
  });

  // --- B: Achievement unlockable ---
  const itemsB = await achievementEngine.getUserAchievements(user.id);
  const firstUnlocked = itemsB.find((i) => i.achievement.id === "first-lesson");
  results.push({
    case: "B",
    ok: Boolean(firstUnlocked?.unlocked && firstUnlocked.unlockedAt),
    detail: `first-lesson unlocked=${firstUnlocked?.unlocked} at=${firstUnlocked?.unlockedAt}`,
  });

  // --- C: Achievement not duplicated ---
  const countBeforeC = await prisma.userAchievement.count({
    where: { userId: user.id, achievementId: "first-lesson" },
  });
  const unlockC = await processGamification(user.id);
  const countAfterC = await prisma.userAchievement.count({
    where: { userId: user.id, achievementId: "first-lesson" },
  });
  results.push({
    case: "C",
    ok:
      countBeforeC === 1 &&
      countAfterC === 1 &&
      !unlockC.newlyUnlocked.some((a) => a.id === "first-lesson") &&
      unlockC.xpGranted === 0,
    detail: `rows=${countBeforeC}->${countAfterC} reUnlocked=${unlockC.newlyUnlocked.map((a) => a.id).join(",") || "none"}`,
  });

  // --- D: Milestone progress updates correctly ---
  await prisma.userProgress.update({
    where: { userId: user.id },
    data: { streak: 14, xp: 1000, totalStudyMinutes: 300 },
  });
  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: { currentLevel: "B1" },
  });
  const progressD = await prisma.userProgress.findUniqueOrThrow({
    where: { userId: user.id },
  });
  const lpD = await prisma.learningProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });
  const milestonesD = achievementEngine.getMilestoneProgress(catalog.milestones, {
    level: lpD.currentLevel,
    streak: progressD.streak,
    xp: progressD.xp,
    studyMinutes: progressD.totalStudyMinutes,
  });
  const a1 = milestonesD.find((m) => m.milestone.id === "milestone-level-a1");
  const b1 = milestonesD.find((m) => m.milestone.id === "milestone-level-b1");
  const b2 = milestonesD.find((m) => m.milestone.id === "milestone-level-b2");
  const streak14 = milestonesD.find(
    (m) => m.milestone.id === "milestone-streak-14"
  );
  const xp1000 = milestonesD.find((m) => m.milestone.id === "milestone-xp-1000");
  const mins300 = milestonesD.find(
    (m) => m.milestone.id === "milestone-minutes-300"
  );
  results.push({
    case: "D",
    ok:
      Boolean(a1?.reached) &&
      Boolean(b1?.reached) &&
      b2?.reached === false &&
      Boolean(streak14?.reached) &&
      streak14?.progress === 14 &&
      Boolean(xp1000?.reached) &&
      Boolean(mins300?.reached),
    detail: `a1=${a1?.reached} b1=${b1?.reached} b2=${b2?.reached} streak=${streak14?.progress}/${streak14?.target} xp=${xp1000?.reached} mins=${mins300?.reached}`,
  });

  // Reset progress fields that would unlock xp-500 etc. before subscription tests
  await wipeUser(user.id);

  // --- E: Tutor Free daily limit ---
  await seedConversationSessions(user.id, "tutor", FREE_DAILY_TUTOR_SESSIONS);
  const tutorGateBlocked = await subscriptionService.canStartConversation(
    user.id,
    "tutor"
  );
  await prisma.conversationSession.deleteMany({
    where: { userId: user.id, type: "tutor" },
  });
  const tutorGateOpen = await subscriptionService.canStartConversation(
    user.id,
    "tutor"
  );
  results.push({
    case: "E",
    ok:
      tutorGateBlocked.allowed === false &&
      tutorGateBlocked.remaining === 0 &&
      tutorGateOpen.allowed === true &&
      tutorGateOpen.remaining === FREE_DAILY_TUTOR_SESSIONS,
    detail: `blocked=${tutorGateBlocked.allowed} remainingOpen=${tutorGateOpen.remaining}`,
  });

  // --- F: Roleplay Free daily limit ---
  await seedConversationSessions(
    user.id,
    "roleplay",
    FREE_DAILY_ROLEPLAY_SESSIONS
  );
  const roleplayBlocked = await subscriptionService.canStartConversation(
    user.id,
    "roleplay"
  );
  await prisma.conversationSession.deleteMany({
    where: { userId: user.id, type: "roleplay" },
  });
  const roleplayOpen = await subscriptionService.canStartConversation(
    user.id,
    "roleplay"
  );
  results.push({
    case: "F",
    ok:
      roleplayBlocked.allowed === false &&
      roleplayBlocked.remaining === 0 &&
      roleplayOpen.allowed === true &&
      roleplayOpen.remaining === FREE_DAILY_ROLEPLAY_SESSIONS,
    detail: `blocked=${roleplayBlocked.allowed} remainingOpen=${roleplayOpen.remaining}`,
  });

  // --- G: Premium bypasses daily limits ---
  await seedConversationSessions(user.id, "tutor", FREE_DAILY_TUTOR_SESSIONS + 5);
  await seedConversationSessions(
    user.id,
    "roleplay",
    FREE_DAILY_ROLEPLAY_SESSIONS + 5
  );
  await subscriptionService.upgradeToPremium(user.id, 30);
  const premiumTutor = await subscriptionService.canStartConversation(
    user.id,
    "tutor"
  );
  const premiumRoleplay = await subscriptionService.canStartConversation(
    user.id,
    "roleplay"
  );
  const premiumDto = await subscriptionService.getForUser(user.id);
  results.push({
    case: "G",
    ok:
      premiumDto.isPremium === true &&
      premiumTutor.allowed === true &&
      premiumRoleplay.allowed === true,
    detail: `isPremium=${premiumDto.isPremium} tutor=${premiumTutor.allowed} roleplay=${premiumRoleplay.allowed}`,
  });

  // --- H: Analytics Free denied (existing Premium policy) ---
  await prisma.subscription.update({
    where: { userId: user.id },
    data: { plan: "FREE", status: "ACTIVE", expiresAt: null },
  });
  const freeSub = await subscriptionService.getForUser(user.id);
  // Replicate /api/analytics/insights gate
  const freeAnalyticsAllowed = freeSub.isPremium;
  results.push({
    case: "H",
    ok: freeSub.isPremium === false && freeAnalyticsAllowed === false,
    detail: `isPremium=${freeSub.isPremium} insightsAllowed=${freeAnalyticsAllowed}`,
  });

  // --- I: Analytics Premium allowed ---
  await subscriptionService.upgradeToPremium(user.id, 30);
  const premiumSub = await subscriptionService.getForUser(user.id);
  let insightsOk = false;
  let insightsDetail = "";
  if (premiumSub.isPremium) {
    const insights = await analyticsInsightsService.getInsights(user.id);
    insightsOk =
      Array.isArray(insights.weeklyActivity) &&
      insights.weeklyActivity.length === 7 &&
      typeof insights.totalSessions === "number";
    insightsDetail = `days=${insights.weeklyActivity.length} sessions=${insights.totalSessions}`;
  }
  results.push({
    case: "I",
    ok: premiumSub.isPremium === true && insightsOk,
    detail: insightsDetail || "premium gate failed",
  });

  // Downgrade for remaining free-path tests
  await prisma.subscription.update({
    where: { userId: user.id },
    data: { plan: "FREE", status: "ACTIVE", expiresAt: null },
  });

  // --- J: Admin CRUD content ---
  cleanupAdminTestFile();
  const payload = {
    id: ADMIN_TEST_ID,
    title: "Phase 5.1 Admin Test",
    level: "A1",
    prompt: "Write one sentence.",
    estimatedMinutes: 5,
  };
  const written = adminContentService.writeItem(
    ADMIN_TEST_BUCKET,
    ADMIN_TEST_ID,
    payload
  );
  const readBack = adminContentService.readItem(
    ADMIN_TEST_BUCKET,
    ADMIN_TEST_ID
  );
  const listed = adminContentService.listItems(ADMIN_TEST_BUCKET);
  const listedHas = listed.some((i) => i.id === ADMIN_TEST_ID);
  const contentMatch = Boolean(
    readBack &&
      typeof readBack.content === "object" &&
      readBack.content !== null &&
      (readBack.content as { title?: string }).title === payload.title
  );
  cleanupAdminTestFile();
  const gone = adminContentService.readItem(ADMIN_TEST_BUCKET, ADMIN_TEST_ID);
  results.push({
    case: "J",
    ok:
      written.id === ADMIN_TEST_ID &&
      contentMatch &&
      listedHas &&
      gone === null,
    detail: `write=${written.id} listed=${listedHas} cleaned=${gone === null}`,
  });

  // --- K: Admin unauthorized denied ---
  const nonAdmin = { email: TEST_EMAIL, role: "USER" as const };
  const adminByRole = { email: "anyone@example.com", role: "ADMIN" as const };
  const denied = !isAdminUser(nonAdmin);
  const allowedByRole = isAdminUser(adminByRole);
  results.push({
    case: "K",
    ok: denied && allowedByRole,
    detail: `userDenied=${denied} adminRoleAllowed=${allowedByRole}`,
  });

  // --- L: Analytics events generated correctly ---
  await prisma.analyticsEvent.deleteMany({ where: { userId: user.id } });
  await analyticsService.track(user.id, "word_saved", { word: "hello" });
  await analyticsService.track(user.id, "speaking_completed", { mode: "repeat" });
  await analyticsService.track(user.id, "tutor_completed", {});
  const eventsL = await prisma.analyticsEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  const namesL = eventsL.map((e) => e.event);
  results.push({
    case: "L",
    ok:
      namesL.includes("word_saved") &&
      namesL.includes("speaking_completed") &&
      namesL.includes("tutor_completed") &&
      eventsL.length === 3,
    detail: `events=${namesL.join(",")}`,
  });

  // --- M: No duplicate word_saved / wordsLearned / XP on repeated vocabulary save ---
  await wipeUser(user.id);
  const wordPayload = {
    word: "phase51word",
    lemma: "phase51word",
    translation: "parola test",
    partOfSpeech: "noun",
    level: "A1",
  };

  // Simulate vocabulary/save create-once semantics used by the route
  async function saveVocabOnce() {
    const existing = await prisma.userVocabulary.findUnique({
      where: {
        userId_word_lemma: {
          userId: user.id,
          word: wordPayload.word,
          lemma: wordPayload.lemma,
        },
      },
    });
    if (existing) {
      await prisma.userVocabulary.update({
        where: { id: existing.id },
        data: { translation: wordPayload.translation },
      });
      return { created: false };
    }
    await prisma.userVocabulary.create({
      data: {
        userId: user.id,
        word: wordPayload.word,
        lemma: wordPayload.lemma,
        translation: wordPayload.translation,
        partOfSpeech: wordPayload.partOfSpeech,
        level: wordPayload.level,
        status: "NEW",
        nextReviewAt: new Date(),
      },
    });
    await prisma.userProgress.update({
      where: { userId: user.id },
      data: { wordsLearned: { increment: 1 }, xp: { increment: 5 } },
    });
    await analyticsService.track(user.id, "word_saved", {
      word: wordPayload.word,
      lemma: wordPayload.lemma,
    });
    return { created: true };
  }

  const firstSave = await saveVocabOnce();
  const mid = await prisma.userProgress.findUniqueOrThrow({
    where: { userId: user.id },
  });
  const secondSave = await saveVocabOnce();
  const end = await prisma.userProgress.findUniqueOrThrow({
    where: { userId: user.id },
  });
  const wordSavedCount = await prisma.analyticsEvent.count({
    where: { userId: user.id, event: "word_saved" },
  });
  results.push({
    case: "M",
    ok:
      firstSave.created === true &&
      secondSave.created === false &&
      mid.wordsLearned === 1 &&
      end.wordsLearned === 1 &&
      mid.xp === 5 &&
      end.xp === 5 &&
      wordSavedCount === 1,
    detail: `created=${firstSave.created}/${secondSave.created} words=${end.wordsLearned} xp=${end.xp} events=${wordSavedCount}`,
  });

  // --- N: No regression on FASI 0–4.1 (phase4-1 runner covers 0→4) ---
  const nOk = await runRegression("scripts/phase4-1-test.ts");
  results.push({
    case: "N",
    ok: nOk,
    detail: nOk
      ? "phase4-1 regression runner (0–4.1) PASS"
      : "phase4-1 regression runner FAIL",
  });

  console.log("\n=== FASE 5.1 TEST REPORT ===\n");
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
  cleanupAdminTestFile();
  await prisma.$disconnect();
  process.exit(1);
});
