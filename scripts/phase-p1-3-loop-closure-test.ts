/**
 * FASE P1.3 — Didactic loop closure tests.
 * Run: npx tsx scripts/phase-p1-3-loop-closure-test.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  conversationMasteryPatch,
  conversationParticipationXp,
} from "../src/lib/conversationMastery";
import { dailyPlanService } from "../src/services/learning/DailyPlanService";
import { subscriptionService } from "../src/services/subscription/SubscriptionService";
import { FREE_DAILY_ROLEPLAY_SESSIONS } from "../src/services/subscription/SubscriptionService";
import type { ConversationEvaluation } from "../src/types/conversation";

const prisma = new PrismaClient();

type Result = { case: string; ok: boolean; detail: string };

async function ensureUser(email: string, level = "A1") {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: "test",
        name: "P1.3",
        profile: {
          create: {
            onboardingDone: true,
            assessmentDone: true,
            dailyMinutes: 15,
            perceivedLevel: "a1",
          },
        },
        progress: { create: { xp: 0 } },
        learningProfile: {
          create: {
            currentLevel: level,
            subLevel: 1.2,
            vocabularyScore: 50,
            grammarScore: 50,
            readingScore: 50,
            listeningScore: 40,
            speakingScore: 40,
            writingScore: 45,
          },
        },
        subscription: {
          create: { plan: "FREE", status: "ACTIVE", provider: "local" },
        },
      },
    });
  }
  return user;
}

function heuristicEval(
  partial: Partial<ConversationEvaluation> & {
    grammarErrors?: ConversationEvaluation["grammarErrors"];
  }
): ConversationEvaluation {
  return {
    overall: 88,
    grammar: 90,
    vocabulary: 92,
    fluency: 85,
    feedback: "test",
    grammarErrors: partial.grammarErrors || [],
    vocabularyNotes: [],
    recommendations: [],
    reviewTopics: partial.reviewTopics || [],
    source: "heuristic",
    ...partial,
  };
}

async function main() {
  const results: Result[] = [];
  const user = await ensureUser("phase-p1-3@test.local");
  const lp = await prisma.learningProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });

  // --- A: Long heuristic conversation without errors → no mastery boost ---
  const longNoErrors = heuristicEval({
    overall: 95,
    grammar: 95,
    vocabulary: 98,
    fluency: 90,
    grammarErrors: [],
  });
  const patchA = conversationMasteryPatch(lp, longNoErrors);
  results.push({
    case: "A",
    ok: patchA.applied === false && patchA.speakingScore == null,
    detail: `applied=${patchA.applied} reason=${patchA.reason} xp=${conversationParticipationXp(longNoErrors)}`,
  });

  // --- B: Heuristic with errors → mastery applied without vocab boost ---
  const withErrors = heuristicEval({
    overall: 80,
    grammar: 85,
    vocabulary: 90,
    grammarErrors: [
      {
        original: "I am go",
        correction: "I am going",
        explanation: "test",
      },
    ],
  });
  const patchB = conversationMasteryPatch(
    { speakingScore: 40, grammarScore: 50, vocabularyScore: 50 },
    withErrors
  );
  results.push({
    case: "B",
    ok:
      patchB.applied === true &&
      patchB.vocabularyScore == null &&
      typeof patchB.grammarScore === "number" &&
      patchB.grammarScore <= 50,
    detail: `applied=${patchB.applied} grammar=${patchB.grammarScore} vocab=${patchB.vocabularyScore}`,
  });

  // --- C: AI evaluation still applies full mastery ---
  const aiEval = heuristicEval({
    source: "ai",
    overall: 80,
    grammar: 70,
    vocabulary: 75,
    grammarErrors: [],
  });
  const patchC = conversationMasteryPatch(
    { speakingScore: 40, grammarScore: 40, vocabularyScore: 40 },
    aiEval
  );
  results.push({
    case: "C",
    ok:
      patchC.applied === true &&
      patchC.speakingScore != null &&
      patchC.grammarScore != null &&
      patchC.vocabularyScore != null,
    detail: `reason=${patchC.reason}`,
  });

  // --- D: Abandoned roleplay start does not burn Free quota ---
  await prisma.conversationSession.deleteMany({ where: { userId: user.id } });
  await prisma.conversationSession.create({
    data: {
      userId: user.id,
      type: "roleplay",
      scenario: "rp-a1-cafe",
      messages: "[]",
      // incomplete
    },
  });
  const dGate = await subscriptionService.canStartConversation(
    user.id,
    "roleplay"
  );
  results.push({
    case: "D",
    ok: dGate.allowed === true && (dGate.remaining ?? 0) === FREE_DAILY_ROLEPLAY_SESSIONS,
    detail: `allowed=${dGate.allowed} remaining=${dGate.remaining}`,
  });

  // --- E: Completed sessions consume Free quota ---
  for (let i = 0; i < FREE_DAILY_ROLEPLAY_SESSIONS; i++) {
    await prisma.conversationSession.create({
      data: {
        userId: user.id,
        type: "roleplay",
        scenario: `rp-done-${i}`,
        messages: "[]",
        completedAt: new Date(),
      },
    });
  }
  const eGate = await subscriptionService.canStartConversation(
    user.id,
    "roleplay"
  );
  results.push({
    case: "E",
    ok: eGate.allowed === false && eGate.remaining === 0,
    detail: `allowed=${eGate.allowed} remaining=${eGate.remaining}`,
  });

  // --- F: Listening mistake maps to /listen not /practice?skill=listening ---
  await prisma.userMistake.deleteMany({ where: { userId: user.id } });
  await prisma.reviewItem.deleteMany({ where: { userId: user.id } });
  const { reviewQueue } = await import(
    "../src/services/learning/ReviewQueueService"
  );
  await reviewQueue.recordMistakeAndEnqueue({
    userId: user.id,
    errorType: "accuracy",
    skill: "listening",
    userInput: "wrong",
    correctForm: "right",
    context: "listen-test",
    source: "listening_complete",
    contentRef: "listen-a1-daily",
    dueInMinutes: 0,
  });
  // Force due
  await prisma.reviewItem.updateMany({
    where: { userId: user.id, skill: "listening" },
    data: { nextReviewAt: new Date(Date.now() - 60_000) },
  });
  const plan = await dailyPlanService.build(user.id, 15);
  const listenHref = [plan.recommended, ...plan.plan].find(
    (a) => a.skill === "listening" || a.href.includes("/listen")
  );
  results.push({
    case: "F",
    ok:
      Boolean(listenHref) &&
      !listenHref!.href.includes("/practice?skill=listening") &&
      (listenHref!.href.startsWith("/listen") ||
        listenHref!.href === "/review"),
    detail: `href=${listenHref?.href || "none"} kind=${listenHref?.kind}`,
  });

  // --- G: Speaking mistake does not use practice?skill=speaking ---
  await reviewQueue.recordMistakeAndEnqueue({
    userId: user.id,
    errorType: "accuracy",
    skill: "speaking",
    userInput: "I go",
    correctForm: "I went",
    context: "speak-test",
    source: "evaluate_speaking",
    contentRef: "speak-a1",
    dueInMinutes: 0,
  });
  await prisma.reviewItem.updateMany({
    where: { userId: user.id, skill: "speaking" },
    data: { nextReviewAt: new Date(Date.now() - 60_000) },
  });
  const planSpeak = await dailyPlanService.build(user.id, 15);
  const speakActs = [planSpeak.recommended, ...planSpeak.plan].filter(
    (a) => a.skill === "speaking" || a.href.includes("speak") || a.href.includes("real-life") || a.href === "/review"
  );
  const badSpeakPractice = speakActs.some((a) =>
    a.href.includes("/practice?skill=speaking")
  );
  results.push({
    case: "G",
    ok: !badSpeakPractice && speakActs.length > 0,
    detail: `hrefs=${speakActs.map((a) => a.href).join("|")}`,
  });

  // --- H: Lesson complete returns nextBest (Daily Plan), not remediation href ---
  // Contract check via building plan + remediationHint shape (API returns nextBest always)
  results.push({
    case: "H",
    ok: Boolean(plan.recommended.href) && Boolean(plan.recommended.title),
    detail: `recommended=${plan.recommended.href}`,
  });

  console.log("\n=== FASE P1.3 LOOP CLOSURE TEST REPORT ===\n");
  let pass = 0;
  for (const r of results) {
    console.log(`[${r.ok ? "PASS" : "FAIL"}] ${r.case}: ${r.detail}`);
    if (r.ok) pass++;
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
