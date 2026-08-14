import type { RankedExerciseTarget } from "@/types/practice";

export function aiExerciseBatchPrompt(input: {
  userLevel: string;
  targets: RankedExerciseTarget[];
  count: number;
}) {
  const targetBlocks = input.targets.slice(0, input.count).map((t) => ({
    targetId: t.id,
    kind: t.kind,
    skill: t.skill,
    label: t.label,
    level: t.level || input.userLevel,
    priority: t.priority,
    payload: t.payload,
    reasons: t.reasons.slice(0, 2),
  }));

  return `You are an English exercise author for Italian learners using the Alinea app.

The learner's CEFR level is ${input.userLevel}. Do NOT change or infer a different level.
You receive pre-selected learning targets chosen by the system. Your job is ONLY to transform each target into one pedagogically useful exercise.

Rules:
- Each exercise must genuinely test the specific target (word, expression, grammar topic, or mistake).
- Use language appropriate for level ${input.userLevel}.
- Prefer contextual/cloze exercises when an example sentence is available.
- For expressions like "look forward to", test the full expression in context, not isolated words.
- For mistake targets, focus on the error pattern shown in userInput vs correctForm.
- exerciseType must be one of: multiple_choice, true_false, fill_blank, matching, translation, sentence_completion, vocabulary_in_context, expression_in_context, grammar_correction
- Return valid JSON only.

Targets (generate exactly one exercise per target, same order):
${JSON.stringify(targetBlocks, null, 2)}

Return JSON:
{
  "exercises": [
    {
      "targetId": "same as input target id",
      "pedagogicalType": "vocabulary_in_context|expression_in_context|grammar_correction|...",
      "prompt": "question in English",
      "promptIt": "optional Italian hint",
      "options": ["only for multiple_choice"],
      "answer": "correct answer string OR array for reorder/match",
      "explanation": "brief explanation in Italian or English"
    }
  ]
}`;
}
