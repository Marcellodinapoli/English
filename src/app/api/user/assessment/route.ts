import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { clampAssessmentLevelForPlan } from "@/lib/assessmentPlacement";
import { subscriptionService } from "@/services/subscription/SubscriptionService";
import type { CEFRLevel } from "@/types/learning";

const schema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      skill: z.string(),
      correct: z.boolean(),
    })
  ),
});

function determineLevel(avg: number, perceived: string) {
  if (avg < 35 || perceived === "zero") {
    return { level: "ZERO" as CEFRLevel, subLevel: 0.1 };
  }
  if (avg < 55) return { level: "A1" as CEFRLevel, subLevel: 1.1 };
  if (avg < 70) return { level: "A1" as CEFRLevel, subLevel: 1.3 };
  if (avg < 85) return { level: "A2" as CEFRLevel, subLevel: 2.1 };
  return { level: "A2" as CEFRLevel, subLevel: 2.2 };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await request.json());
  const skills = [
    "vocabulary",
    "grammar",
    "reading",
    "listening",
    "speaking",
    "pronunciation",
    "writing",
  ] as const;

  const skillScores: Record<string, number> = {};
  for (const skill of skills) {
    const items = body.answers.filter((a) => a.skill === skill);
    if (!items.length) {
      skillScores[skill] =
        skill === "speaking" || skill === "pronunciation" || skill === "writing"
          ? 20
          : 10;
      continue;
    }
    const correct = items.filter((i) => i.correct).length;
    skillScores[skill] = Math.round((correct / items.length) * 100);
  }

  const assessed =
    (skillScores.vocabulary +
      skillScores.grammar +
      skillScores.reading +
      skillScores.listening) /
    4;

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
  });
  const raw = determineLevel(assessed, profile?.perceivedLevel || "zero");
  const sub = await subscriptionService.getForUser(user.id);
  const determined = clampAssessmentLevelForPlan(raw, sub.isPremium);

  await prisma.assessmentResult.create({
    data: {
      userId: user.id,
      type: "onboarding",
      skillScores: JSON.stringify(skillScores),
      determinedLevel: determined.level,
      determinedSubLevel: determined.subLevel,
    },
  });

  await prisma.learningProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      currentLevel: determined.level,
      subLevel: determined.subLevel,
      vocabularyScore: skillScores.vocabulary,
      grammarScore: skillScores.grammar,
      readingScore: skillScores.reading,
      listeningScore: skillScores.listening,
      speakingScore: skillScores.speaking,
      pronunciationScore: skillScores.pronunciation,
      pronunciationEvaluated: false,
      writingScore: skillScores.writing,
    },
    update: {
      currentLevel: determined.level,
      subLevel: determined.subLevel,
      vocabularyScore: skillScores.vocabulary,
      grammarScore: skillScores.grammar,
      readingScore: skillScores.reading,
      listeningScore: skillScores.listening,
      speakingScore: skillScores.speaking,
      pronunciationScore: skillScores.pronunciation,
      pronunciationEvaluated: false,
      writingScore: skillScores.writing,
    },
  });

  await prisma.userProfile.update({
    where: { userId: user.id },
    data: { onboardingDone: true, assessmentDone: true },
  });

  await prisma.userProgress.update({
    where: { userId: user.id },
    data: {
      assessmentsTaken: { increment: 1 },
      xp: { increment: 50 },
      lastActiveDate: new Date(),
      streak: 1,
    },
  });

  await analyticsService.track(user.id, "assessment_completed", {
    level: determined.level,
    skillScores,
    clampedForFree: !sub.isPremium && raw.level !== determined.level,
  });

  return NextResponse.json({
    level: determined.level,
    subLevel: determined.subLevel,
    skillScores,
  });
}
