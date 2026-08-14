/**
 * Phase 4 — OpenAI integration tests (A–AC).
 * Run: npx tsx scripts/phase4-ai-test.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  clearContextualMeaningCache,
  contextualMeaningCacheKey,
  contextualMeaningCacheSize,
  getCachedContextualMeaning,
  getInFlightContextualMeaning,
  setCachedContextualMeaning,
  setInFlightContextualMeaning,
} from "../src/services/ai/cache/contextualMeaningCache";
import {
  aiExerciseBatchSchema,
  contextualMeaningSchema,
  speakingEvaluationSchema,
  writingEvaluationSchema,
} from "../src/services/ai/schemas";
import {
  AICallError,
  chatJsonValidated,
  clearChatJsonValidatedTestHook,
  resetOpenAIClientForTests,
  setChatJsonValidatedTestHook,
} from "../src/services/ai/aiCall";
import {
  clearRecentAICallLogs,
  getRecentAICallLogs,
} from "../src/services/ai/logging";
import { getAIConfig, getFunctionConfig } from "../src/services/ai/config";
import { AIService } from "../src/services/ai/AIService";
import { StubAIProvider } from "../src/services/ai/providers/StubAIProvider";
import { heuristicSpeakingEvaluation } from "../src/services/ai/heuristics";
import { errorEngine } from "../src/services/learning/ErrorEngine";
import { aiExerciseProvider } from "../src/services/learning/exercise-providers/AIExerciseProvider";
import { ruleBasedExerciseProvider } from "../src/services/learning/exercise-providers/RuleBasedExerciseProvider";
import { heuristicConversationEvaluation } from "../src/services/ai/heuristics/conversation";

const prisma = new PrismaClient();

async function ensureUser(email: string) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: "test",
        name: "Phase4 Test",
        profile: { create: { onboardingDone: true, dailyMinutes: 20 } },
        progress: { create: {} },
        learningProfile: {
          create: {
            currentLevel: "B1",
            vocabularyScore: 55,
            grammarScore: 50,
            readingScore: 60,
            pronunciationScore: 0,
            pronunciationEvaluated: false,
          },
        },
      },
    });
  }
  return user;
}

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

async function main() {
  const results: Array<{ case: string; ok: boolean; detail: string }> = [];
  // Phase 4 exercises the AI infrastructure with a test key; production default is AI_ENABLED=false.
  process.env.AI_ENABLED = "true";
  const user = await ensureUser("phase4-ai@test.local");
  clearContextualMeaningCache();
  clearRecentAICallLogs();
  clearChatJsonValidatedTestHook();
  resetOpenAIClientForTests();

  await prisma.analyticsEvent.deleteMany({
    where: { userId: user.id, event: "ai_call" },
  });
  await prisma.reviewItem.deleteMany({ where: { userId: user.id } });
  await prisma.userMistake.deleteMany({ where: { userId: user.id } });

  const { reviewQueue } = await import(
    "../src/services/learning/ReviewQueueService"
  );
  const { personalizedExerciseService } = await import(
    "../src/services/learning/PersonalizedExerciseService"
  );

  // --- A: valid AI exercise schema ---
  const validExerciseBatch = aiExerciseBatchSchema.safeParse({
    exercises: [
      {
        targetId: "VOCAB:abc",
        pedagogicalType: "vocabulary_in_context",
        prompt: "Complete: I look forward _____ meeting you.",
        options: ["to", "for", "at", "on"],
        answer: "to",
        explanation: "look forward to + gerund/noun",
      },
    ],
  });
  results.push({
    case: "A",
    ok: validExerciseBatch.success,
    detail: validExerciseBatch.success ? "schema accepts valid exercise" : "schema rejected",
  });

  // --- B: invalid JSON schema → fallback (provider returns []) ---
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key-phase4";
  setChatJsonValidatedTestHook(async () => {
    throw new AICallError("Schema validation failed", "validation_failed");
  });
  const invalidAi = await aiExerciseProvider.generate({
    userId: user.id,
    userLevel: "B1",
    count: 2,
    targets: [
      {
        id: "VOCAB:test",
        kind: "low_mastery_word",
        priority: 10,
        reasons: ["test"],
        itemType: "VOCABULARY",
        itemId: "w1",
        skill: "vocabulary",
        label: "hello",
        payload: { word: "hello", translation: "ciao" },
      },
    ],
  });
  clearChatJsonValidatedTestHook();
  const ruleFallback = await ruleBasedExerciseProvider.generate({
    userId: user.id,
    userLevel: "B1",
    count: 2,
    targets: [
      {
        id: "VOCAB:test",
        kind: "low_mastery_word",
        priority: 10,
        reasons: ["test"],
        itemType: "VOCABULARY",
        itemId: "w1",
        skill: "vocabulary",
        label: "hello",
        payload: { word: "hello", translation: "ciao", example: "Hello world" },
      },
    ],
  });
  results.push({
    case: "B",
    ok: invalidAi.length === 0 && ruleFallback.length > 0,
    detail: `ai=${invalidAi.length} rule=${ruleFallback.length}`,
  });

  // --- C: no API key → app works (stub) ---
  const savedKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const stubService = new AIService(new StubAIProvider());
  const stubWriting = await stubService.evaluateWriting({
    text: "I went yesterday.",
    prompt: "Write about your day",
    level: "A1",
  });
  process.env.OPENAI_API_KEY = savedKey;
  results.push({
    case: "C",
    ok: stubWriting.source === "heuristic" && stubWriting.overall > 0,
    detail: `source=${stubWriting.source} overall=${stubWriting.overall}`,
  });

  // --- D: contextual meaning catalog → no AI (annotated) ---
  const annotated = await stubService.getContextualMeaning({
    word: "book",
    sentence: "I read a book.",
    annotatedTranslation: "libro",
    pos: "noun",
  });
  results.push({
    case: "D",
    ok: annotated.source === "annotation" && annotated.translation === "libro",
    detail: `source=${annotated.source}`,
  });

  // --- E: missing meaning → stub fallback when no key ---
  delete process.env.OPENAI_API_KEY;
  const stubSvc2 = new AIService(new StubAIProvider());
  const missing = await stubSvc2.getContextualMeaning({
    word: "ephemeral",
    sentence: "The moment was ephemeral.",
    level: "B2",
  });
  process.env.OPENAI_API_KEY = savedKey;
  results.push({
    case: "E",
    ok: missing.source === "fallback",
    detail: `source=${missing.source}`,
  });

  // --- F: writing structured errors ---
  const writingParsed = writingEvaluationSchema.safeParse({
    overall: 70,
    grammar: 65,
    vocabulary: 72,
    accuracy: 68,
    fluency: 70,
    feedback: "Buon lavoro",
    suggestions: [],
    mistakes: [
      {
        original: "he go",
        correction: "he goes",
        type: "grammar",
        topic: "third_person_singular",
        skill: "grammar",
      },
    ],
  });
  results.push({
    case: "F",
    ok: writingParsed.success,
    detail: writingParsed.success ? "structured mistakes valid" : "schema fail",
  });

  // --- G: writing error → ReviewQueue with metadata ---
  await prisma.userMistake.deleteMany({ where: { userId: user.id } });
  await prisma.reviewItem.deleteMany({ where: { userId: user.id } });
  const structured = errorEngine.analyzeStructured(
    [
      {
        original: "he go",
        correction: "he goes",
        type: "grammar",
        topic: "third_person_singular",
        skill: "grammar",
        context: "Daily routine",
      },
    ],
    "Daily routine"
  );
  for (const err of structured) {
    await reviewQueue.recordMistakeAndEnqueue({
      userId: user.id,
      errorType: err.errorType,
      skill: err.skill,
      userInput: err.userInput,
      correctForm: err.correctForm,
      context: "Daily routine",
      source: "evaluate_writing",
      metadata: { topic: err.topic, sourceType: err.sourceType },
    });
  }
  const mistake = await prisma.userMistake.findFirst({
    where: { userId: user.id, userInput: "he go" },
  });
  const review = await prisma.reviewItem.findFirst({
    where: { userId: user.id, itemType: "MISTAKE" },
  });
  const meta = review?.metadata ? JSON.parse(review.metadata) : {};
  results.push({
    case: "G",
    ok:
      Boolean(mistake) &&
      Boolean(review) &&
      meta.topic === "third_person_singular",
    detail: `mistake=${Boolean(mistake)} topic=${meta.topic}`,
  });

  // --- H: tutor structured feedback schema ---
  const convEval = heuristicConversationEvaluation({
    type: "tutor",
    level: "A1",
    messages: [
      {
        id: "1",
        role: "user",
        content: "I am go to school",
        timestamp: new Date().toISOString(),
      },
    ],
  });
  results.push({
    case: "H",
    ok: convEval.feedback.length > 0 && typeof convEval.overall === "number",
    detail: `overall=${convEval.overall} errors=${convEval.grammarErrors.length}`,
  });

  // --- I: speaking no fake pronunciation ---
  const speaking = heuristicSpeakingEvaluation({
    transcript: "I went to the shop yesterday",
    mode: "free",
    expectedText: "I went to the shop yesterday",
  });
  results.push({
    case: "I",
    ok:
      speaking.pronunciationAssessed === false &&
      !("pronunciation" in speaking && speaking.pronunciation != null),
    detail: `assessed=${speaking.pronunciationAssessed}`,
  });

  // --- J: API key not in client-facing config ---
  const cfg = getAIConfig();
  const cfgJson = JSON.stringify(cfg);
  results.push({
    case: "J",
    ok: !cfgJson.includes("sk-") && cfg.hasApiKey === Boolean(savedKey?.trim()),
    detail: `hasApiKey=${cfg.hasApiKey}`,
  });

  // --- K: timeout → fallback ---
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key-phase4";
  setChatJsonValidatedTestHook(async () => {
    throw new AICallError("OpenAI request timeout", "timeout");
  });
  const timeoutItems = await aiExerciseProvider.generate({
    userId: user.id,
    userLevel: "A1",
    count: 1,
    targets: [
      {
        id: "t1",
        kind: "skill_weakness",
        priority: 5,
        reasons: ["test"],
        itemType: "SKILL",
        itemId: "grammar",
        skill: "grammar",
        label: "grammar",
        payload: {},
      },
    ],
  });
  clearChatJsonValidatedTestHook();
  results.push({
    case: "K",
    ok: timeoutItems.length === 0,
    detail: `aiItems=${timeoutItems.length} (fallback to rule in service)`,
  });

  // --- L: 429 retry then fallback ---
  let calls = 0;
  setChatJsonValidatedTestHook(async () => {
    calls += 1;
    if (calls === 1) throw new AICallError("Rate limited", "rate_limited", 429);
    throw new AICallError("Still failing", "api_error");
  });
  try {
    await chatJsonValidated({
      fn: "contextual_meaning",
      system: "test",
      user: "test",
      schema: contextualMeaningSchema,
      userId: user.id,
    });
  } catch {
    // expected
  }
  clearChatJsonValidatedTestHook();
  results.push({
    case: "L",
    ok: calls >= 2,
    detail: `attempts=${calls}`,
  });

  // --- R: contextual meaning cache hit ---
  clearContextualMeaningCache();
  const key = contextualMeaningCacheKey("run", "I run every day", "A1");
  setCachedContextualMeaning(key, {
    word: "run",
    translation: "correre",
    partOfSpeech: "verb",
    example: "I run every day",
    otherMeanings: [],
    source: "ai",
  });
  const cached = getCachedContextualMeaning(key);
  results.push({
    case: "R",
    ok: cached?.translation === "correre" && contextualMeaningCacheSize() === 1,
    detail: `cached=${cached?.translation}`,
  });

  // --- S: concurrent dedup ---
  clearContextualMeaningCache();
  const dedupKey = contextualMeaningCacheKey("bank", "I bank online", "B1");
  let resolvePromise!: (v: unknown) => void;
  const slowPromise = new Promise((resolve) => {
    resolvePromise = resolve;
  });
  setInFlightContextualMeaning(
    dedupKey,
    slowPromise as Promise<{
      word: string;
      translation: string;
      partOfSpeech: string;
      example: string;
      otherMeanings: [];
      source: "ai";
    }>
  );
  const inflight = getInFlightContextualMeaning(dedupKey);
  resolvePromise({
    word: "bank",
    translation: "banca",
    partOfSpeech: "noun",
    example: "I bank online",
    otherMeanings: [],
    source: "ai",
  });
  results.push({
    case: "S",
    ok: inflight != null,
    detail: `inFlight=${Boolean(inflight)}`,
  });

  // --- T: AI exercise batch one call N exercises ---
  clearChatJsonValidatedTestHook();
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key-phase4";
  setChatJsonValidatedTestHook(async () => ({
    data: {
      exercises: [
        {
          targetId: "t1",
          pedagogicalType: "fill_blank",
          prompt: "I look forward _____ seeing you.",
          answer: "to",
        },
        {
          targetId: "t2",
          pedagogicalType: "multiple_choice",
          prompt: "Choose the correct form",
          options: ["go", "goes", "going", "gone"],
          answer: "goes",
        },
      ],
    },
    model: "gpt-4o-mini",
    latencyMs: 10,
    retried: false,
  }));
  const batchItems = await aiExerciseProvider.generate({
    userId: user.id,
    userLevel: "B1",
    count: 2,
    targets: [
      {
        id: "t1",
        kind: "low_mastery_expression",
        priority: 20,
        reasons: ["expr"],
        itemType: "EXPRESSION",
        itemId: "e1",
        skill: "expression",
        label: "look forward to",
        payload: { expression: "look forward to" },
      },
      {
        id: "t2",
        kind: "grammar_weakness",
        priority: 15,
        reasons: ["grammar"],
        itemType: "GRAMMAR",
        itemId: "g1",
        skill: "grammar",
        label: "third person",
        payload: {},
      },
    ],
  });
  clearChatJsonValidatedTestHook();
  results.push({
    case: "T",
    ok: batchItems.length === 2 && batchItems.every((i) => i.provider === "ai"),
    detail: `items=${batchItems.length}`,
  });

  // --- U: invalid single exercise → rule fills gap ---
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key-phase4";
  setChatJsonValidatedTestHook(async () => ({
    data: {
      exercises: [
        {
          targetId: "t1",
          pedagogicalType: "multiple_choice",
          prompt: "Bad exercise missing options",
          answer: "x",
        },
      ],
    },
    model: "gpt-4o-mini",
    latencyMs: 5,
    retried: false,
  }));
  const partial = await aiExerciseProvider.generate({
    userId: user.id,
    userLevel: "A1",
    count: 1,
    targets: [
      {
        id: "t1",
        kind: "low_mastery_word",
        priority: 10,
        reasons: ["w"],
        itemType: "VOCABULARY",
        itemId: "v1",
        skill: "vocabulary",
        label: "hello",
        payload: { word: "hello", translation: "ciao", example: "Hello!" },
      },
    ],
  });
  clearChatJsonValidatedTestHook();
  results.push({
    case: "U",
    ok: partial.length >= 1,
    detail: `providers=${partial.map((p) => p.provider).join(",")}`,
  });

  // --- V: writing metadata preserved (same as G extended) ---
  results.push({
    case: "V",
    ok: mistake?.correctForm === "he goes" && structured[0]?.topic === "third_person_singular",
    detail: `errorType=${mistake?.errorType}`,
  });

  // --- W: speaking profile pronunciationEvaluated stays false ---
  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: { pronunciationEvaluated: false, pronunciationScore: 0 },
  });
  const lpBefore = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  const evalResult = heuristicSpeakingEvaluation({
    transcript: "Hello my name is Marco",
    mode: "free",
  });
  const updateData: Record<string, unknown> = {
    speakingScore: 60,
    grammarScore: lpBefore!.grammarScore,
  };
  if (
    evalResult.pronunciationAssessed === true &&
    "pronunciation" in evalResult &&
    evalResult.pronunciation != null
  ) {
    updateData.pronunciationScore = 50;
    updateData.pronunciationEvaluated = true;
  }
  await prisma.learningProfile.update({
    where: { userId: user.id },
    data: updateData,
  });
  const lpAfter = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  results.push({
    case: "W",
    ok: lpAfter?.pronunciationEvaluated === false,
    detail: `evaluated=${lpAfter?.pronunciationEvaluated}`,
  });

  // --- X: timeout logged ---
  clearRecentAICallLogs();
  setChatJsonValidatedTestHook(async () => {
    throw new AICallError("OpenAI request timeout", "timeout");
  });
  try {
    await chatJsonValidated({
      fn: "writing_eval",
      system: "t",
      user: "u",
      schema: writingEvaluationSchema,
      userId: user.id,
    });
  } catch {
    /* expected */
  }
  clearChatJsonValidatedTestHook();
  const timeoutLog = getRecentAICallLogs().find((l) => l.outcome === "timeout");
  results.push({
    case: "X",
    ok: Boolean(timeoutLog),
    detail: timeoutLog ? `latency=${timeoutLog.latencyMs}` : "no log",
  });

  // --- Y: covered in L ---
  results.push({
    case: "Y",
    ok: calls >= 2,
    detail: "see L",
  });

  // --- Z: no key full app path ---
  delete process.env.OPENAI_API_KEY;
  const session = await personalizedExerciseService.generateSession(user.id, {
    count: 3,
    provider: "ai",
  });
  process.env.OPENAI_API_KEY = savedKey;
  results.push({
    case: "Z",
    ok: session.items.length > 0 && session.provider === "rule",
    detail: `provider=${session.provider} items=${session.items.length}`,
  });

  // --- AA: API responses no key ---
  const aaPayload = {
    evaluation: evalResult,
    config: getAIConfig(),
    session: { provider: session.provider },
  };
  const aaStr = JSON.stringify(aaPayload);
  results.push({
    case: "AA",
    ok: !aaStr.includes("sk-") && !aaStr.includes(process.env.OPENAI_API_KEY || "___"),
    detail: "no key in serialized API-shaped payload",
  });

  // --- AB: logging usage/model/latency ---
  setChatJsonValidatedTestHook(async () => ({
    data: {
      translation: "test",
      partOfSpeech: "noun",
      otherMeanings: [],
    },
    model: getFunctionConfig("contextual_meaning").model,
    latencyMs: 42,
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    retried: false,
  }));
  await chatJsonValidated({
    fn: "contextual_meaning",
    system: "s",
    user: "u",
    schema: contextualMeaningSchema,
    userId: user.id,
  });
  clearChatJsonValidatedTestHook();
  const log = getRecentAICallLogs()[0];
  results.push({
    case: "AB",
    ok:
      log?.model === getFunctionConfig("contextual_meaning").model &&
      log.latencyMs >= 0 &&
      log.outcome === "success",
    detail: `model=${log?.model} latency=${log?.latencyMs}`,
  });

  // --- AC: regressions 0–3.5 ---
  for (const [label, script] of [
    ["AC-0", "scripts/phase0-review-queue-test.ts"],
    ["AC-1", "scripts/phase1-reading-cycle-test.ts"],
    ["AC-2", "scripts/phase2-personalized-exercises-test.ts"],
    ["AC-3", "scripts/phase3-daily-plan-test.ts"],
    ["AC-3.5", "scripts/phase3-5-test.ts"],
  ] as const) {
    const ok = await runRegression(script);
    results.push({ case: label, ok, detail: ok ? "PASS" : "FAIL" });
  }

  // speaking schema rejects pronunciation field requirement
  const speakSchema = speakingEvaluationSchema.safeParse({
    overall: 80,
    accuracy: 75,
    fluency: 70,
    vocabulary: 72,
    grammar: 78,
    feedback: "ok",
    suggestions: [],
    corrections: [],
  });
  results.push({
    case: "I-schema",
    ok: speakSchema.success,
    detail: "speaking schema without pronunciation",
  });

  console.log("\n=== PHASE 4 AI TEST REPORT ===\n");
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
  clearChatJsonValidatedTestHook();
  await prisma.$disconnect();
  process.exit(1);
});
