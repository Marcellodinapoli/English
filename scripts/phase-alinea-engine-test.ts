/**
 * Alinea-only didactic verification (AI dormant).
 * Run: npx tsx scripts/phase-alinea-engine-test.ts
 *
 * Proves the product loop works with RuleBased + heuristics + engines,
 * without an operational OpenAI connection.
 */
import { PrismaClient } from "@prisma/client";
import { getAIConfig, isAIOperational } from "../src/services/ai/config";
import { AIService } from "../src/services/ai/AIService";
import { StubAIProvider } from "../src/services/ai/providers/StubAIProvider";
import { contentService } from "../src/services/content/ContentService";
import { dailyPlanService } from "../src/services/learning/DailyPlanService";
import { lessonEngine } from "../src/services/learning/LessonEngine";
import { levelProgressionEngine } from "../src/services/learning/LevelProgressionEngine";
import { personalizedExerciseService } from "../src/services/learning/PersonalizedExerciseService";
import { reviewQueue } from "../src/services/learning/ReviewQueueService";
import { toLearningProfileDTO } from "../src/lib/learningProfile";

const prisma = new PrismaClient();
const EMAIL = "alinea-engine@test.local";

type Result = { case: string; ok: boolean; detail: string };

async function ensureUser() {
  let user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: EMAIL,
        passwordHash: "test",
        name: "Alinea Engine",
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
            currentLevel: "A1",
            subLevel: 1,
            vocabularyScore: 35,
            grammarScore: 40,
            readingScore: 38,
            listeningScore: 42,
            speakingScore: 36,
            writingScore: 40,
            pronunciationScore: 0,
            pronunciationEvaluated: false,
          },
        },
        subscription: {
          create: { plan: "FREE", status: "ACTIVE", provider: "local" },
        },
      },
    });
  }
  await prisma.reviewItem.deleteMany({ where: { userId: user.id } });
  await prisma.userVocabulary.deleteMany({ where: { userId: user.id } });
  await prisma.userMistake.deleteMany({ where: { userId: user.id } });
  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: {
      currentLevel: "A1",
      vocabularyScore: 35,
      grammarScore: 40,
      readingScore: 38,
      listeningScore: 42,
      speakingScore: 36,
      writingScore: 40,
    },
  });
  return user;
}

async function main() {
  const results: Result[] = [];

  // Force dormant AI for this process (does not write .env)
  delete process.env.AI_ENABLED;
  process.env.AI_ENABLED = "false";

  // --- A: AI dormant ---
  const cfg = getAIConfig();
  results.push({
    case: "A",
    ok: !isAIOperational() && cfg.provider === "stub" && cfg.operational === false,
    detail: `operational=${cfg.operational} provider=${cfg.provider}`,
  });

  // --- B: Default AIService uses stub ---
  const service = new AIService();
  results.push({
    case: "B",
    ok: service.getConfig().provider === "stub",
    detail: `provider=${service.getConfig().provider}`,
  });

  const user = await ensureUser();
  const lp = await prisma.learningProfile.findUniqueOrThrow({
    where: { userId: user.id },
  });

  // --- C: Curriculum content available ---
  const lesson = contentService.getLesson("a1-u1-l1");
  const passage = contentService.getPassage("a1-meeting-someone");
  results.push({
    case: "C",
    ok: Boolean(lesson && passage),
    detail: `lesson=${lesson?.id} passage=${passage?.id}`,
  });

  // --- D: LessonEngine builds session without AI ---
  const profile = toLearningProfileDTO(lp);
  const session = lesson
    ? lessonEngine.buildSession(lesson, profile)
    : null;
  results.push({
    case: "D",
    ok: Boolean(session && session.steps.length > 0),
    detail: `steps=${session?.steps.length ?? 0}`,
  });

  // --- E: RuleBased practice ---
  const practice = await personalizedExerciseService.generateSession(user.id, {
    count: 5,
    provider: "rule",
  });
  results.push({
    case: "E",
    ok: practice.provider === "rule" && practice.items.length > 0,
    detail: `provider=${practice.provider} n=${practice.items.length}`,
  });

  // --- F: provider:ai while dormant still falls back to rule ---
  const practiceAi = await personalizedExerciseService.generateSession(user.id, {
    count: 3,
    provider: "ai",
  });
  results.push({
    case: "F",
    ok: practiceAi.provider === "rule" && practiceAi.items.length > 0,
    detail: `provider=${practiceAi.provider} n=${practiceAi.items.length}`,
  });

  // --- G: ReviewQueue ---
  const word = await prisma.userVocabulary.create({
    data: {
      userId: user.id,
      word: "alinea",
      lemma: "alinea",
      translation: "allinea",
      partOfSpeech: "noun",
      status: "NEW",
      nextReviewAt: new Date(Date.now() - 60_000),
    },
  });
  await reviewQueue.enqueue({
    userId: user.id,
    itemType: "VOCABULARY",
    itemId: word.id,
    skill: "vocabulary",
    source: "alinea-engine-test",
    dueInMinutes: 0,
  });
  const due = await reviewQueue.listDue(user.id, 5);
  results.push({
    case: "G",
    ok: due.items.length >= 1,
    detail: `due=${due.items.length}`,
  });

  // --- H: DailyPlan ---
  const plan = await dailyPlanService.build(user.id, 20);
  results.push({
    case: "H",
    ok: plan.plan.length > 0 && Boolean(plan.recommended.href),
    detail: `n=${plan.plan.length} first=${plan.recommended.kind}:${plan.recommended.href}`,
  });

  // --- I: LevelProgressionEngine (no mutation of engines) ---
  const progression = await levelProgressionEngine.evaluate(user.id);
  results.push({
    case: "I",
    ok: progression.currentLevel === "A1" && typeof progression.readyToPromote === "boolean",
    detail: `level=${progression.currentLevel} ready=${progression.readyToPromote}`,
  });

  // --- J: Heuristic speaking / writing / tutor (stub) ---
  const stub = new AIService(new StubAIProvider());
  const speaking = await stub.evaluateSpeaking({
    transcript: "Hello, my name is Anna.",
    expectedText: "Hello, my name is Anna.",
    mode: "repeat",
    level: "A1",
  });
  const writing = await stub.evaluateWriting({
    text: "I go to school every day.",
    prompt: "Write about your day",
    level: "A1",
  });
  const tutor = await stub.generateTutorResponse({
    messages: [],
    userMessage: "Hello",
    context: {
      level: "A1",
      subLevel: 1,
      weakSkills: ["grammar"],
      problematicGrammar: [],
      goal: "Practice",
    },
  });
  results.push({
    case: "J",
    ok:
      speaking.source === "heuristic" &&
      speaking.pronunciationAssessed === false &&
      writing.source === "heuristic" &&
      tutor.source === "heuristic",
    detail: `speak=${speaking.source} write=${writing.source} tutor=${tutor.source}`,
  });

  // --- K: Contextual meaning without OpenAI ---
  const meaning = await stub.getContextualMeaning({
    word: "hello",
    sentence: "Hello, how are you?",
    annotatedTranslation: "ciao",
  });
  results.push({
    case: "K",
    ok: meaning.source === "annotation" && meaning.translation === "ciao",
    detail: `source=${meaning.source} t=${meaning.translation}`,
  });

  console.log("\n=== ALINEA ENGINE (AI DORMANT) TEST REPORT ===\n");
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
