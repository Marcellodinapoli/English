import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getWeakSkills, toLearningProfileDTO } from "@/lib/learningProfile";
import { prisma } from "@/lib/prisma";
import { aiService } from "@/services/ai/AIService";
import { contentService } from "@/services/content/ContentService";
import type { ConversationMessage } from "@/types/conversation";

const schema = z.object({
  content: z.string().min(1).max(2000),
});

function parseMessages(raw: string): ConversationMessage[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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

export async function POST(
  request: Request,
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

  const { content } = schema.parse(await request.json());
  const messages = parseMessages(session.messages);
  const userMsg = newMessage("user", content.trim());
  messages.push(userMsg);

  const profile = toLearningProfileDTO(user.learningProfile);
  let assistantMsg: ConversationMessage;

  if (session.type === "roleplay" && session.scenario) {
    const scenario = contentService.getRoleplay(session.scenario);
    if (!scenario) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    const response = await aiService.generateRoleplayResponse(
      {
        messages,
        userMessage: content,
        scenario,
        level: profile.currentLevel,
      },
      { userId: user.id }
    );

    assistantMsg = newMessage(
      "assistant",
      response.message,
      response.sceneNote
    );
  } else {
    const response = await aiService.generateTutorResponse(
      {
        messages,
        userMessage: content,
        context: {
          level: profile.currentLevel,
          subLevel: profile.subLevel,
          weakSkills: getWeakSkills(profile.masteryScores, 3, {
            pronunciationEvaluated:
              user.learningProfile.pronunciationEvaluated ?? false,
          }),
          problematicGrammar: profile.problematicGrammarTopics,
          goal: user.profile?.goal || undefined,
        },
      },
      { userId: user.id }
    );

    assistantMsg = newMessage(
      "assistant",
      response.message,
      response.hint || response.encouragement
    );
  }

  messages.push(assistantMsg);

  await prisma.conversationSession.update({
    where: { id: session.id },
    data: { messages: JSON.stringify(messages) },
  });

  const scenario = session.scenario
    ? contentService.getRoleplay(session.scenario)
    : null;
  const userTurns = messages.filter((m) => m.role === "user").length;
  const canComplete =
    session.type === "tutor"
      ? userTurns >= 2
      : userTurns >= Math.min(3, scenario?.maxTurns || 3);

  return NextResponse.json({
    messages,
    canComplete,
    userTurns,
    maxTurns: scenario?.maxTurns,
  });
}
