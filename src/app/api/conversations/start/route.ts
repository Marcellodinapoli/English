import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getWeakSkills, toLearningProfileDTO } from "@/lib/learningProfile";
import { prisma } from "@/lib/prisma";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { subscriptionService } from "@/services/subscription/SubscriptionService";
import { contentService } from "@/services/content/ContentService";
import { heuristicTutorWelcome } from "@/services/ai/heuristics/conversation";
import type { ConversationMessage } from "@/types/conversation";

const schema = z.object({
  type: z.enum(["tutor", "roleplay"]),
  scenarioId: z.string().optional(),
});

function newMessage(
  role: ConversationMessage["role"],
  content: string,
  hint?: string
): ConversationMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date().toISOString(),
    hint,
  };
}

function parseMessages(raw: string): ConversationMessage[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.learningProfile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await request.json());

  // Resume incomplete session first (same type / scenario) — avoids burning quota.
  const open = await prisma.conversationSession.findFirst({
    where: {
      userId: user.id,
      type: body.type,
      completedAt: null,
      ...(body.type === "roleplay" && body.scenarioId
        ? { scenario: body.scenarioId }
        : body.type === "tutor"
          ? { scenario: null }
          : {}),
    },
    orderBy: { startedAt: "desc" },
  });

  if (open) {
    const profile = toLearningProfileDTO(user.learningProfile);
    return NextResponse.json({
      sessionId: open.id,
      type: body.type,
      scenario: open.scenario,
      messages: parseMessages(open.messages),
      resumed: true,
      profile: {
        level: profile.currentLevel,
        weakSkills: getWeakSkills(profile.masteryScores),
      },
    });
  }

  const gate = await subscriptionService.canStartConversation(
    user.id,
    body.type
  );
  if (!gate.allowed) {
    return NextResponse.json(
      { error: gate.reason, upgradeHref: "/subscription" },
      { status: 403 }
    );
  }

  const profile = toLearningProfileDTO(user.learningProfile);
  const weakSkills = getWeakSkills(profile.masteryScores);

  const messages: ConversationMessage[] = [];
  let scenario: string | null = null;

  if (body.type === "roleplay") {
    if (!body.scenarioId) {
      return NextResponse.json(
        { error: "scenarioId required for roleplay" },
        { status: 400 }
      );
    }
    const content = contentService.getRoleplay(body.scenarioId);
    if (!content) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }
    scenario = content.id;
    messages.push(
      newMessage("assistant", content.openingLine, content.goals.join(" · "))
    );
  } else {
    const welcome = heuristicTutorWelcome(
      profile.currentLevel,
      user.profile?.goal || undefined
    );
    messages.push(newMessage("assistant", welcome.message, welcome.hint));
  }

  const session = await prisma.conversationSession.create({
    data: {
      userId: user.id,
      type: body.type,
      scenario,
      messages: JSON.stringify(messages),
    },
  });

  await analyticsService.track(
    user.id,
    body.type === "roleplay" ? "roleplay_started" : "tutor_started",
    { sessionId: session.id, scenario }
  );

  return NextResponse.json({
    sessionId: session.id,
    type: body.type,
    scenario,
    messages,
    resumed: false,
    profile: {
      level: profile.currentLevel,
      weakSkills,
    },
  });
}
