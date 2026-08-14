import type { ExerciseItem } from "@/types/content";

export interface ExerciseAttempt {
  exerciseId: string;
  userAnswer: string | string[];
}

export interface ExerciseEvaluation {
  exerciseId: string;
  correct: boolean;
  expected: string | string[];
  userAnswer: string | string[];
  explanation?: string;
}

export interface ExerciseSessionResult {
  total: number;
  correctCount: number;
  score: number;
  evaluations: ExerciseEvaluation[];
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[.?!,;:]+$/g, "");
}

export class ExerciseEngine {
  evaluateOne(exercise: ExerciseItem, userAnswer: string | string[]): ExerciseEvaluation {
    const expected = exercise.answer;
    let correct = false;

    if (Array.isArray(expected)) {
      const answers = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
      correct =
        expected.length === answers.length &&
        expected.every((e, i) => normalize(String(answers[i] || "")) === normalize(e));
    } else {
      correct = normalize(String(userAnswer)) === normalize(String(expected));
    }

    return {
      exerciseId: exercise.id,
      correct,
      expected,
      userAnswer,
      explanation: exercise.explanation,
    };
  }

  evaluateSession(
    exercises: ExerciseItem[],
    attempts: ExerciseAttempt[]
  ): ExerciseSessionResult {
    const evaluations = exercises.map((ex) => {
      const attempt = attempts.find((a) => a.exerciseId === ex.id);
      return this.evaluateOne(ex, attempt?.userAnswer ?? "");
    });
    const correctCount = evaluations.filter((e) => e.correct).length;
    const total = evaluations.length || 1;
    return {
      total: evaluations.length,
      correctCount,
      score: Math.round((correctCount / total) * 100),
      evaluations,
    };
  }
}

export const exerciseEngine = new ExerciseEngine();