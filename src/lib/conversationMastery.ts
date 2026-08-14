import type { ConversationEvaluation } from "@/types/conversation";
import { adaptiveEngine } from "@/services/learning/AdaptiveEngine";

/**
 * Conversation → mastery contract (AI dormant safe).
 * Heuristic length/verbosity scores must not boost CEFR-relevant skills.
 * AI-sourced evaluations keep full mastery updates.
 */
export function conversationMasteryPatch(
  lp: {
    speakingScore: number;
    grammarScore: number;
    vocabularyScore: number;
  },
  evaluation: ConversationEvaluation
): {
  speakingScore?: number;
  grammarScore?: number;
  vocabularyScore?: number;
  applied: boolean;
  reason: string;
} {
  const isAi = evaluation.source === "ai";
  const errorCount = evaluation.grammarErrors?.length ?? 0;

  if (isAi) {
    return {
      speakingScore: adaptiveEngine.updateMastery(
        lp.speakingScore,
        evaluation.overall / 100
      ),
      grammarScore: adaptiveEngine.updateMastery(
        lp.grammarScore,
        evaluation.grammar / 100
      ),
      vocabularyScore: adaptiveEngine.updateMastery(
        lp.vocabularyScore,
        evaluation.vocabulary / 100
      ),
      applied: true,
      reason: "ai_evaluation",
    };
  }

  // Heuristic without reliable error signals → no skill boost (participation XP only).
  if (errorCount === 0) {
    return {
      applied: false,
      reason: "heuristic_no_reliable_signals",
    };
  }

  // Errors detected: reinforce weakness (low performance), never inflate from verbosity.
  const errorPerformance = Math.max(0.25, 0.55 - errorCount * 0.1);
  return {
    speakingScore: adaptiveEngine.updateMastery(
      lp.speakingScore,
      errorPerformance,
      0.15
    ),
    grammarScore: adaptiveEngine.updateMastery(
      lp.grammarScore,
      errorPerformance,
      0.25
    ),
    // Do not boost vocabulary from word-count heuristics.
    applied: true,
    reason: "heuristic_errors_only",
  };
}

export function conversationParticipationXp(
  evaluation: ConversationEvaluation
): number {
  if (evaluation.source === "ai") {
    return Math.max(10, Math.round(evaluation.overall / 6));
  }
  // Fixed participation XP — independent of verbosity scores.
  const errors = evaluation.grammarErrors?.length ?? 0;
  return errors > 0 ? 12 : 10;
}
