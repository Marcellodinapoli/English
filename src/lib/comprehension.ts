import type { ExerciseItem } from "@/types/content";
import type { ComprehensionQuestion } from "@/types/expression";

/** Map a comprehension question to an ExercisePlayer / ExerciseEngine item. */
export function comprehensionToExercise(
  q: ComprehensionQuestion
): ExerciseItem {
  if (q.type === "true_false") {
    return {
      id: q.id,
      type: "multiple_choice",
      prompt: q.question,
      options: q.options?.length ? q.options : ["True", "False"],
      answer: String(q.correctAnswer),
      explanation: q.explanation,
    };
  }

  if (
    q.type === "multiple_choice" ||
    q.type === "main_idea" ||
    q.type === "detail"
  ) {
    if (q.options?.length) {
      return {
        id: q.id,
        type: "multiple_choice",
        prompt: q.question,
        options: q.options,
        answer: String(
          Array.isArray(q.correctAnswer) ? q.correctAnswer[0] : q.correctAnswer
        ),
        explanation: q.explanation,
      };
    }
  }

  return {
    id: q.id,
    type: "fill_blank",
    prompt: q.question,
    answer: Array.isArray(q.correctAnswer)
      ? q.correctAnswer
      : q.correctAnswer,
    explanation: q.explanation,
  };
}
