import { chatJsonValidated, getOpenAIClient } from "@/services/ai/aiCall";
import { aiExerciseBatchPrompt } from "@/services/ai/prompts/aiExercise";
import { aiExerciseBatchSchema } from "@/services/ai/schemas";
import type { ExerciseItem } from "@/types/content";
import type {
  ExerciseGenerationContext,
  ExerciseProvider,
  PersonalizedExercise,
  PedagogicalExerciseType,
  RankedExerciseTarget,
} from "@/types/practice";
import { ruleBasedExerciseProvider } from "./RuleBasedExerciseProvider";

function toExerciseItem(
  item: {
    targetId: string;
    pedagogicalType: PedagogicalExerciseType;
    prompt: string;
    promptIt?: string;
    options?: string[];
    answer: string | string[];
    explanation?: string;
  },
  _target: RankedExerciseTarget
): ExerciseItem | null {
  const type =
    item.pedagogicalType === "multiple_choice" ||
    item.pedagogicalType === "true_false" ||
    item.pedagogicalType === "translation"
      ? "multiple_choice"
      : item.pedagogicalType === "matching" || item.pedagogicalType === "grammar_correction"
        ? "fill_blank"
        : "fill_blank";

  if (type === "multiple_choice") {
    if (!item.options?.length || item.options.length < 2) return null;
    const answer = String(
      Array.isArray(item.answer) ? item.answer[0] : item.answer
    );
    if (!answer) return null;
    return {
      id: `ai-${item.targetId}`,
      type: "multiple_choice",
      prompt: item.prompt,
      promptIt: item.promptIt,
      options: item.options,
      answer,
      explanation: item.explanation,
    };
  }

  const answer = item.answer;
  if (!answer || (Array.isArray(answer) && !answer.length)) return null;
  return {
    id: `ai-${item.targetId}`,
    type: "fill_blank",
    prompt: item.prompt,
    promptIt: item.promptIt,
    answer,
    explanation: item.explanation,
  };
}

export class AIExerciseProvider implements ExerciseProvider {
  readonly id = "ai" as const;

  async generate(ctx: ExerciseGenerationContext): Promise<PersonalizedExercise[]> {
    if (!getOpenAIClient() || !ctx.targets.length) return [];

    const batchTargets = ctx.targets.slice(0, ctx.count);
    try {
      const result = await chatJsonValidated({
        fn: "ai_exercise",
        system:
          "You create pedagogically valid English exercises for Italian learners. Return strict JSON only.",
        user: aiExerciseBatchPrompt({
          userLevel: ctx.userLevel,
          targets: batchTargets,
          count: ctx.count,
        }),
        schema: aiExerciseBatchSchema,
        userId: ctx.userId,
      });

      const targetById = new Map(batchTargets.map((t) => [t.id, t]));
      const valid: PersonalizedExercise[] = [];
      const missingTargets: RankedExerciseTarget[] = [];

      for (const item of result.data.exercises) {
        const target = targetById.get(item.targetId);
        if (!target) continue;
        const exercise = toExerciseItem(item, target);
        if (!exercise) {
          missingTargets.push(target);
          continue;
        }
        valid.push({
          id: exercise.id,
          provider: "ai",
          pedagogicalType: item.pedagogicalType as PedagogicalExerciseType,
          exercise,
          target,
        });
      }

      const covered = new Set(valid.map((v) => v.target.id));
      for (const t of batchTargets) {
        if (!covered.has(t.id) && !missingTargets.some((m) => m.id === t.id)) {
          missingTargets.push(t);
        }
      }

      if (missingTargets.length && valid.length < ctx.count) {
        const fallbackCtx = {
          ...ctx,
          targets: missingTargets,
          count: ctx.count - valid.length,
        };
        const fallbackItems =
          await ruleBasedExerciseProvider.generate(fallbackCtx);
        valid.push(...fallbackItems);
      }

      return valid.slice(0, ctx.count);
    } catch {
      return [];
    }
  }
}

export const aiExerciseProvider = new AIExerciseProvider();
