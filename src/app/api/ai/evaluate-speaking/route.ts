import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiService } from "@/services/ai/AIService";
import { adaptiveEngine } from "@/services/learning/AdaptiveEngine";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { errorEngine } from "@/services/learning/ErrorEngine";
import { processGamification } from "@/lib/gamification";
import { recordUserActivity } from "@/lib/userActivity";
import { reviewQueue } from "@/services/learning/ReviewQueueService";
import { isPremiumRequiredForLevel } from "@/lib/contentAccess";
import { gateCurriculumContent } from "@/lib/contentGate";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const mode = String(form.get("mode") || "repeat") as "repeat" | "free";
  const expectedText = String(form.get("expectedText") || "");
  const prompt = String(form.get("prompt") || "");
  const level = String(form.get("level") || "A1");
  const durationMs = Number(form.get("durationMs") || 0);
  let transcript = String(form.get("transcript") || "").trim();
  const audio = form.get("audio");

  if (isPremiumRequiredForLevel(level)) {
    const gate = await gateCurriculumContent(level);
    if (!gate.ok) return gate.response;
  }

  if (audio && audio instanceof File && audio.size > 0) {
    try {
      const buffer = Buffer.from(await audio.arrayBuffer());
      const whispered = await aiService.transcribeAudio(
        buffer,
        audio.type || "audio/webm"
      );
      if (whispered.trim()) transcript = whispered.trim();
    } catch {
      // keep client transcript fallback
    }
  }

  if (!transcript) {
    return NextResponse.json(
      {
        error:
          "No speech detected. Allow microphone access and try again, or type what you said.",
      },
      { status: 400 }
    );
  }

  const evaluation = await aiService.evaluateSpeaking(
    {
      transcript,
      expectedText: expectedText || undefined,
      mode,
      prompt,
      level,
      durationMs: durationMs || undefined,
    },
    { userId: user.id }
  );

  for (const correction of evaluation.corrections || []) {
    const structured = errorEngine.analyzeStructured(
      [
        {
          original: correction.from,
          correction: correction.to,
          type: correction.type || correction.reason,
          topic: correction.topic,
          skill: "speaking",
          context: prompt,
        },
      ],
      prompt
    );
    const detected =
      structured.length > 0
        ? structured
        : errorEngine.analyze(correction.from, correction.to, prompt);
    for (const err of detected) {
      await reviewQueue.recordMistakeAndEnqueue({
        userId: user.id,
        errorType: err.errorType,
        skill: "speaking",
        userInput: err.userInput,
        correctForm: err.correctForm,
        context: prompt,
        source: "evaluate_speaking",
        contentRef: prompt || expectedText || undefined,
        level,
        metadata: {
          topic: err.topic,
          sourceType: err.sourceType,
          aiSource: evaluation.source,
        },
      });
    }
  }

  const lp = await prisma.learningProfile.findUnique({
    where: { userId: user.id },
  });
  if (lp) {
    const profileUpdate: {
      speakingScore: number;
      grammarScore: number;
      pronunciationScore?: number;
      pronunciationEvaluated?: boolean;
    } = {
      speakingScore: adaptiveEngine.updateMastery(
        lp.speakingScore,
        evaluation.overall / 100
      ),
      grammarScore: adaptiveEngine.updateMastery(
        lp.grammarScore,
        evaluation.grammar / 100
      ),
    };

    if (
      evaluation.pronunciationAssessed === true &&
      evaluation.pronunciation != null
    ) {
      profileUpdate.pronunciationScore = adaptiveEngine.updateMastery(
        lp.pronunciationScore,
        evaluation.pronunciation / 100
      );
      profileUpdate.pronunciationEvaluated = true;
    }

    await prisma.learningProfile.update({
      where: { userId: user.id },
      data: profileUpdate,
    });
  }

  await recordUserActivity(user.id, {
    studyMinutes: 2,
    xp: Math.max(8, Math.round(evaluation.overall / 8)),
  });

  await analyticsService.track(user.id, "speaking_completed", {
    mode,
    overall: evaluation.overall,
    source: evaluation.source,
    pronunciationAssessed: evaluation.pronunciationAssessed ?? false,
  });

  const gamification = await processGamification(user.id);

  return NextResponse.json({ evaluation, gamification });
}
