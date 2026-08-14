import { z } from "zod";

const score = z.number().min(0).max(100);

export const contextualMeaningSchema = z.object({
  translation: z.string().min(1),
  partOfSpeech: z.string().min(1),
  phonetic: z.string().optional(),
  shortExplanation: z.string().optional(),
  exampleTranslation: z.string().optional(),
  level: z.string().optional(),
  otherMeanings: z
    .array(
      z.object({
        translation: z.string(),
        partOfSpeech: z.string(),
      })
    )
    .optional()
    .default([]),
});

export const aiExerciseItemSchema = z.object({
  targetId: z.string().min(1),
  pedagogicalType: z.enum([
    "multiple_choice",
    "true_false",
    "fill_blank",
    "matching",
    "translation",
    "sentence_completion",
    "vocabulary_in_context",
    "expression_in_context",
    "grammar_correction",
  ]),
  prompt: z.string().min(1),
  promptIt: z.string().optional(),
  options: z.array(z.string()).optional(),
  answer: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  explanation: z.string().optional(),
});

export const aiExerciseBatchSchema = z.object({
  exercises: z.array(aiExerciseItemSchema).min(1),
});

export const writingMistakeSchema = z.object({
  original: z.string().min(1),
  correction: z.string().min(1),
  type: z.string().min(1),
  topic: z.string().optional(),
  skill: z
    .enum(["grammar", "vocabulary", "writing", "speaking", "reading"])
    .optional(),
});

export const writingEvaluationSchema = z.object({
  overall: score,
  grammar: score,
  vocabulary: score,
  accuracy: score,
  fluency: score,
  appropriateness: score.optional(),
  coherence: score.optional(),
  feedback: z.string().min(1),
  suggestions: z.array(z.string()).default([]),
  correctedText: z.string().optional(),
  mistakes: z.array(writingMistakeSchema).default([]),
});

export const speakingEvaluationSchema = z.object({
  overall: score,
  accuracy: score,
  fluency: score,
  vocabulary: score,
  grammar: score,
  transcriptQuality: score.optional(),
  feedback: z.string().min(1),
  suggestions: z.array(z.string()).default([]),
  corrections: z
    .array(
      z.object({
        from: z.string().min(1),
        to: z.string().min(1),
        reason: z.string().min(1),
        type: z.string().optional(),
        topic: z.string().optional(),
      })
    )
    .default([]),
});

export const tutorResponseSchema = z.object({
  message: z.string().min(1),
  hint: z.string().optional(),
  encouragement: z.string().optional(),
});

export const roleplayResponseSchema = z.object({
  message: z.string().min(1),
  sceneNote: z.string().optional(),
});

export const conversationEvaluationSchema = z.object({
  overall: score,
  grammar: score,
  vocabulary: score,
  fluency: score,
  feedback: z.string().min(1),
  grammarErrors: z
    .array(
      z.object({
        original: z.string().min(1),
        correction: z.string().min(1),
        explanation: z.string().min(1),
        type: z.string().optional(),
        topic: z.string().optional(),
      })
    )
    .default([]),
  vocabularyNotes: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  reviewTopics: z.array(z.string()).default([]),
});

export type ContextualMeaningAI = z.infer<typeof contextualMeaningSchema>;
export type AIExerciseItem = z.infer<typeof aiExerciseItemSchema>;
export type WritingEvaluationAI = z.infer<typeof writingEvaluationSchema>;
export type SpeakingEvaluationAI = z.infer<typeof speakingEvaluationSchema>;
