import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toLearningProfileDTO } from "@/lib/learningProfile";
import { prisma } from "@/lib/prisma";
import { aiService } from "@/services/ai/AIService";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { contentService } from "@/services/content/ContentService";
import { errorEngine } from "@/services/learning/ErrorEngine";
import { processGamification } from "@/lib/gamification";
import { recordUserActivity } from "@/lib/userActivity";
import {
  conversationMasteryPatch,
  conversationParticipationXp,
} from "@/lib/conversationMastery";
import type { ConversationMessage } from "@/types/conversation";
import { reviewQueue } from "@/services/learning/ReviewQueueService";

function parseMessages(raw: string): ConversationMessage[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.learningProfile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const session = await prisma.conversationSession.findFirst({
    where: { id, userId: user.id, completedAt: null },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const messages = parseMessages(session.messages);
  const userTurns = messages.filter((m) => m.role === "user").length;
  if (userTurns < 1) {
    return NextResponse.json(
      { error: "Send at least one message before completing." },
      { status: 400 }
    );
  }

  const profile = toLearningProfileDTO(user.learningProfile);
  const scenario = session.scenario
    ? contentService.getRoleplay(session.scenario)
    : undefined;

  const evaluation = await aiService.evaluateConversation(
    {
      type: session.type as "tutor" | "roleplay",
      messages,
      level: profile.currentLevel,
      scenario: scenario || undefined,
    },
    { userId: user.id }
  );

  let mistakesEnqueued = 0;
  for (const err of evaluation.grammarErrors) {
    const structured = errorEngine.analyzeStructured(
      [
        {
          original: err.original,
          correction: err.correction,
          type: err.type || "grammar",
          topic: err.topic,
          skill: session.type === "roleplay" ? "speaking" : "grammar",
          context: scenario?.title || "conversation",
        },
      ],
      scenario?.title || "conversation"
    );
    const detected =
      structured.length > 0
        ? structured
        : errorEngine.analyze(
            err.original,
            err.correction,
            scenario?.title || "conversation"
          );
    for (const mistake of detected) {
      await reviewQueue.recordMistakeAndEnqueue({
        userId: user.id,
        errorType: mistake.errorType,
        skill: session.type === "roleplay" ? "speaking" : mistake.skill,
        userInput: mistake.userInput,
        correctForm: mistake.correctForm,
        context: scenario?.title || "Tutor",
        source:
          session.type === "roleplay" ? "roleplay_complete" : "tutor_complete",
        contentRef: session.scenario || session.id,
        level: profile.currentLevel,
        metadata: {
          topic: mistake.topic || err.topic,
          sourceType: err.type,
          explanation: err.explanation,
          aiSource: evaluation.source,
        },
      });
      mistakesEnqueued += 1;
    }
  }

  // Map review topics → GRAMMAR queue when ErrorEngine can resolve a topic id.
  for (const topicLabel of evaluation.reviewTopics || []) {
    const grammar =
      contentService.listGrammar().find(
        (g) =>
          g.title.toLowerCase().includes(topicLabel.toLowerCase()) ||
          topicLabel.toLowerCase().includes(g.title.toLowerCase())
      ) || null;
    if (!grammar) continue;
    await reviewQueue.enqueue({
      userId: user.id,
      itemType: "GRAMMAR",
      itemId: grammar.id,
      skill: "grammar",
      source:
        session.type === "roleplay" ? "roleplay_complete" : "tutor_complete",
      contentRef: session.scenario || session.id,
      level: profile.currentLevel,
      context: topicLabel,
      bumpDueOnUpdate: true,
      metadata: { topicLabel, fromConversation: true },
    });
  }

  // Heuristic sessions without mistakes: still seed Review with scenario phrases.
  if (
    evaluation.source !== "ai" &&
    mistakesEnqueued === 0 &&
    scenario?.suggestedPhrases?.length
  ) {
    for (const phrase of scenario.suggestedPhrases.slice(0, 2)) {
      const itemId = `conv-phrase-${session.id}-${phrase
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40)}`;
      await reviewQueue.enqueue({
        userId: user.id,
        itemType: "SENTENCE",
        itemId,
        skill: "speaking",
        source: "roleplay_complete",
        contentRef: session.scenario || session.id,
        level: profile.currentLevel,
        context: scenario.title,
        dueInMinutes: 60,
        bumpDueOnUpdate: true,
        metadata: {
          sentence: phrase,
          translation: "",
          fromConversation: true,
        },
      });
    }
  }

  const lp = user.learningProfile;
  const mastery = conversationMasteryPatch(lp, evaluation);
  if (mastery.applied) {
    await prisma.learningProfile.update({
      where: { userId: user.id },
      data: {
        ...(mastery.speakingScore != null
          ? { speakingScore: mastery.speakingScore }
          : {}),
        ...(mastery.grammarScore != null
          ? { grammarScore: mastery.grammarScore }
          : {}),
        ...(mastery.vocabularyScore != null
          ? { vocabularyScore: mastery.vocabularyScore }
          : {}),
      },
    });
  }

  await recordUserActivity(user.id, {
    studyMinutes: scenario?.estimatedMinutes || 5,
    xp: conversationParticipationXp(evaluation),
  });

  await prisma.conversationSession.update({
    where: { id: session.id },
    data: {
      evaluation: JSON.stringify({
        ...evaluation,
        masteryApplied: mastery.applied,
        masteryReason: mastery.reason,
      }),
      score: evaluation.overall,
      completedAt: new Date(),
    },
  });

  await analyticsService.track(
    user.id,
    session.type === "roleplay" ? "roleplay_completed" : "tutor_completed",
    {
      sessionId: session.id,
      overall: evaluation.overall,
      scenario: session.scenario,
      masteryApplied: mastery.applied,
      masteryReason: mastery.reason,
    }
  );

  const gamification = await processGamification(user.id);

  return NextResponse.json({
    evaluation,
    gamification,
    masteryApplied: mastery.applied,
    masteryReason: mastery.reason,
    nextHref: mistakesEnqueued > 0 || (evaluation.reviewTopics?.length ?? 0) > 0
      ? "/review"
      : "/home",
  });
}
