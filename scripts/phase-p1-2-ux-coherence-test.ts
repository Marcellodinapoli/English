/**
 * FASE P1.2 — UX / navigation coherence (single recommended next, Free ceiling UX, roleplay honesty).
 * Run: npx tsx scripts/phase-p1-2-ux-coherence-test.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  FREE_MAX_CONTENT_LEVEL,
  isPremiumRequiredForLevel,
  maxAccessibleContentLevel,
} from "../src/lib/contentAccess";
import { dailyPlanService } from "../src/services/learning/DailyPlanService";
import { adaptiveEngine } from "../src/services/learning/AdaptiveEngine";
import { subscriptionService } from "../src/services/subscription/SubscriptionService";
import { contentService } from "../src/services/content/ContentService";
import { isAIOperational } from "../src/services/ai/config";

const prisma = new PrismaClient();

type Result = { case: string; ok: boolean; detail: string };

async function ensureUser(
  email: string,
  opts: { premium: boolean; level: string }
) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: "test",
        name: "P1.2 Test",
        profile: {
          create: {
            onboardingDone: true,
            assessmentDone: true,
            perceivedLevel: "a1",
            dailyMinutes: 15,
          },
        },
        progress: { create: {} },
        learningProfile: {
          create: {
            currentLevel: opts.level,
            subLevel: opts.level === "A1" ? 1.2 : 2.1,
            vocabularyScore: 40,
            grammarScore: 45,
            readingScore: 42,
            listeningScore: 38,
            speakingScore: 35,
            writingScore: 40,
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
  } else {
    await prisma.learningProfile.update({
      where: { userId: user.id },
      data: {
        currentLevel: opts.level,
        vocabularyScore: 40,
        grammarScore: 45,
        readingScore: 42,
        listeningScore: 38,
      },
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
  }
  return user;
}

async function main() {
  const results: Result[] = [];

  const freeA1 = await ensureUser("phase-p1-2-free-a1@test.local", {
    premium: false,
    level: "A1",
  });
  const freeA2 = await ensureUser("phase-p1-2-free-a2@test.local", {
    premium: false,
    level: "A2",
  });
  const premium = await ensureUser("phase-p1-2-premium@test.local", {
    premium: true,
    level: "A2",
  });

  // --- A: Progress recommended === DailyPlan recommended (same source) ---
  const planA = await dailyPlanService.build(freeA1.id, 15);
  // Simulate /api/progress recommendation wiring
  const progressRecommended = planA.recommended;
  results.push({
    case: "A",
    ok:
      Boolean(progressRecommended.href) &&
      progressRecommended.id === planA.recommended.id &&
      progressRecommended.href === planA.plan[0]?.href,
    detail: `href=${progressRecommended.href} id=${progressRecommended.id}`,
  });

  // --- B: AdaptiveEngine legacy is NOT the Progress source (hrefs differ or plan uses kinds) ---
  const legacy = adaptiveEngine.recommendNextActivity(
    {
      currentLevel: "A1",
      subLevel: 1.2,
      masteryScores: {
        vocabulary: 40,
        grammar: 45,
        reading: 42,
        listening: 38,
        speaking: 35,
        pronunciation: 30,
        writing: 40,
      },
      knownWordIds: [],
      weakWordIds: [],
      acquiredGrammarTopics: [],
      problematicGrammarTopics: [],
      studiedTopics: [],
      topicsToConsolidate: [],
    },
    0
  );
  results.push({
    case: "B",
    ok:
      planA.recommended.kind != null ||
      planA.recommended.href !== legacy.href ||
      planA.recommended.title !== legacy.title,
    detail: `daily=${planA.recommended.href}|${planA.recommended.kind} legacy=${legacy.href}`,
  });

  // --- C: Free A1 accessible content cap ---
  const capA1 = maxAccessibleContentLevel(false, "A1");
  results.push({
    case: "C",
    ok: capA1 === FREE_MAX_CONTENT_LEVEL && FREE_MAX_CONTENT_LEVEL === "A1",
    detail: `cap=${capA1}`,
  });

  // --- D: Free profile A2 still content-capped at A1 (no LevelProgression change) ---
  const capA2 = maxAccessibleContentLevel(false, "A2");
  const lpA2 = await prisma.learningProfile.findUniqueOrThrow({
    where: { userId: freeA2.id },
  });
  results.push({
    case: "D",
    ok:
      lpA2.currentLevel === "A2" &&
      capA2 === "A1" &&
      isPremiumRequiredForLevel("A2"),
    detail: `level=${lpA2.currentLevel} contentCap=${capA2}`,
  });

  // --- E: Free daily plan never recommends premium curriculum hrefs ---
  const planFreeA2 = await dailyPlanService.build(freeA2.id, 15);
  const badHref = [planFreeA2.recommended, ...planFreeA2.plan].some((a) =>
    /\/(learn|read|listen|grammar|speak)\/.*(a2|b1|b2|c1)/i.test(a.href)
  );
  results.push({
    case: "E",
    ok: !badHref,
    detail: `hrefs=${[planFreeA2.recommended, ...planFreeA2.plan]
      .map((a) => a.href)
      .join("|")}`,
  });

  // --- F: Roleplay list marks above-Free scenarios; quota metadata present ---
  const freeSub = await subscriptionService.getForUser(freeA1.id);
  const roleplayItems = contentService.listRoleplay().map((item) => ({
    ...item,
    aboveFreeCurriculum:
      !freeSub.isPremium && isPremiumRequiredForLevel(item.level),
  }));
  const gate = await subscriptionService.canStartConversation(
    freeA1.id,
    "roleplay"
  );
  const hasAbove = roleplayItems.some((i) => i.aboveFreeCurriculum);
  const hasInBand = roleplayItems.some((i) => !i.aboveFreeCurriculum);
  results.push({
    case: "F",
    ok: hasAbove && hasInBand && typeof gate.remaining === "number",
    detail: `above=${hasAbove} inBand=${hasInBand} remaining=${gate.remaining}`,
  });

  // --- G: Roleplay quota unchanged (start still allowed when remaining > 0) ---
  results.push({
    case: "G",
    ok: gate.allowed === true && (gate.remaining ?? 0) > 0,
    detail: `allowed=${gate.allowed} remaining=${gate.remaining}`,
  });

  // --- H: Premium features copy no longer claims “All Real Life scenarios” alone ---
  const premSub = await subscriptionService.getForUser(premium.id);
  results.push({
    case: "H",
    ok:
      premSub.isPremium &&
      premSub.features.some((f) => /A2|curriculum/i.test(f)) &&
      !premSub.features.includes("All Real Life scenarios") &&
      !premSub.features.some((f) => /Whisper/i.test(f)),
    detail: `features=${premSub.features.join(";")}`,
  });

  // --- I: AI dormant flag ---
  results.push({
    case: "I",
    ok: isAIOperational() === false || process.env.AI_ENABLED === "true",
    detail: `operational=${isAIOperational()} AI_ENABLED=${process.env.AI_ENABLED || "unset"}`,
  });

  // --- J: Free Free features still list ZERO→A1 ---
  const freeDto = await subscriptionService.getForUser(freeA1.id);
  results.push({
    case: "J",
    ok: freeDto.features.some((f) => /ZERO/i.test(f) && /A1/i.test(f)),
    detail: `features=${freeDto.features.join(";")}`,
  });

  console.log("\n=== FASE P1.2 UX COHERENCE TEST REPORT ===\n");
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
