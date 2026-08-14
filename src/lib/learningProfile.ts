import { parseJsonArray } from "@/lib/auth";
import type { CEFRLevel, LearningProfileDTO, MasteryScores } from "@/types/learning";

type LearningProfileRow = {
  currentLevel: string;
  subLevel: number;
  vocabularyScore: number;
  grammarScore: number;
  readingScore: number;
  listeningScore: number;
  speakingScore: number;
  pronunciationScore: number;
  pronunciationEvaluated?: boolean;
  writingScore: number;
  knownWordIds: string;
  weakWordIds: string;
  acquiredGrammarTopics: string;
  problematicGrammarTopics: string;
  studiedTopics: string;
  topicsToConsolidate: string;
};

export function toLearningProfileDTO(lp: LearningProfileRow): LearningProfileDTO {
  return {
    currentLevel: lp.currentLevel as CEFRLevel,
    subLevel: lp.subLevel,
    masteryScores: {
      vocabulary: lp.vocabularyScore,
      grammar: lp.grammarScore,
      reading: lp.readingScore,
      listening: lp.listeningScore,
      speaking: lp.speakingScore,
      pronunciation: lp.pronunciationScore,
      writing: lp.writingScore,
    },
    knownWordIds: parseJsonArray(lp.knownWordIds),
    weakWordIds: parseJsonArray(lp.weakWordIds),
    acquiredGrammarTopics: parseJsonArray(lp.acquiredGrammarTopics),
    problematicGrammarTopics: parseJsonArray(lp.problematicGrammarTopics),
    studiedTopics: parseJsonArray(lp.studiedTopics),
    topicsToConsolidate: parseJsonArray(lp.topicsToConsolidate),
  };
}

export function getWeakSkills(
  scores: MasteryScores,
  limit = 3,
  options?: { pronunciationEvaluated?: boolean }
): string[] {
  const rankable = (Object.entries(scores) as [keyof MasteryScores, number][])
    .filter(
      ([skill]) =>
        skill !== "pronunciation" || options?.pronunciationEvaluated === true
    )
    .sort((a, b) => a[1] - b[1]);
  return rankable.slice(0, limit).map(([skill]) => skill);
}
