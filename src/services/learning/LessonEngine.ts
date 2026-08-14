import type { LessonContent, LessonStepDef } from "@/types/content";
import { contentService } from "@/services/content/ContentService";
import type {
  LearningProfileDTO,
  LessonOutcomeQuality,
  StepResult,
} from "@/types/learning";

export interface LessonSession {
  lesson: LessonContent;
  steps: LessonStepDef[];
  currentIndex: number;
  results: StepResult[];
}

export interface LessonCompletionAssessment {
  quality: LessonOutcomeQuality;
  needsRemediation: boolean;
  score: number;
  summary: string;
  remediation?: {
    href: string;
    reason: string;
    kind: string;
  };
}

/**
 * LessonEngine orchestrates dynamic lesson steps and performance assessment.
 * ReviewQueue / PersonalizedExerciseService remain the single write paths for
 * mistakes and practice — this engine only shapes steps + outcome labels.
 */
export class LessonEngine {
  buildSession(
    lesson: LessonContent,
    profile?: LearningProfileDTO | null
  ): LessonSession {
    const filtered = lesson.steps.filter((step) => {
      if (step.required !== false) return true;
      if (!profile) return true;
      if (step.type === "grammar" && profile.masteryScores.grammar >= 85) {
        return false;
      }
      if (step.type === "vocabulary" && profile.masteryScores.vocabulary >= 90) {
        return false;
      }
      return true;
    });

    const steps: LessonStepDef[] = [];
    for (const step of filtered) {
      steps.push(step);
      if (
        step.type === "reading" &&
        step.contentRef &&
        step.contentRef !== "self"
      ) {
        const comprehension = contentService.getComprehension(step.contentRef);
        if (comprehension?.questions?.length) {
          steps.push({
            id: `${step.id}-comprehension`,
            type: "comprehension",
            contentRef: step.contentRef,
            required: true,
            title: "Comprehension check",
          });
        }
      }
    }

    return {
      lesson,
      steps,
      currentIndex: 0,
      results: [],
    };
  }

  getCurrentStep(session: LessonSession): LessonStepDef | null {
    return session.steps[session.currentIndex] ?? null;
  }

  completeStep(session: LessonSession, result: StepResult): LessonSession {
    const results = [...session.results, result];
    return {
      ...session,
      results,
      currentIndex: Math.min(session.currentIndex + 1, session.steps.length),
    };
  }

  isComplete(session: LessonSession) {
    return session.currentIndex >= session.steps.length;
  }

  getProgress(session: LessonSession) {
    if (!session.steps.length) return 0;
    return Math.round((session.currentIndex / session.steps.length) * 100);
  }

  /**
   * Classify lesson performance without blocking completion.
   */
  assessCompletion(
    score: number,
    options?: { wrongCount?: number; hasExercises?: boolean }
  ): LessonCompletionAssessment {
    const hasExercises = options?.hasExercises ?? true;
    const wrongCount = options?.wrongCount ?? 0;

    if (!hasExercises) {
      return {
        quality: "completed",
        needsRemediation: false,
        score,
        summary: "Lesson completed — keep practising with review and reading.",
      };
    }

    if (score >= 80 && wrongCount <= 1) {
      return {
        quality: "strong",
        needsRemediation: false,
        score,
        summary: "Strong performance — this skill can be deprioritised for now.",
      };
    }

    if (score >= 55) {
      return {
        quality: "adequate",
        needsRemediation: wrongCount >= 2,
        score,
        summary:
          wrongCount >= 2
            ? "Completed with some difficulty — remediation recommended."
            : "Solid completion — reinforce with a short practice set.",
        remediation:
          wrongCount >= 2
            ? {
                href: "/practice?skill=grammar",
                reason: "Practice the items you missed",
                kind: "practice",
              }
            : undefined,
      };
    }

    return {
      quality: "struggling",
      needsRemediation: true,
      score,
      summary:
        "Completed with difficulty — prioritise review and targeted practice next.",
      remediation: {
        href: wrongCount > 0 ? "/review" : "/practice",
        reason:
          wrongCount > 0
            ? "Clear due mistakes before moving on"
            : "Personalised practice for weak points",
        kind: wrongCount > 0 ? "review" : "practice",
      },
    };
  }

  averageStepScore(results: StepResult[]) {
    if (!results.length) return null;
    return (
      results.reduce((sum, r) => sum + r.score, 0) / results.length
    );
  }
}

export const lessonEngine = new LessonEngine();
