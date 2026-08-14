export type CEFRLevel = "ZERO" | "A1" | "A2" | "B1" | "B2" | "C1";

export type SkillKey =
  | "vocabulary"
  | "grammar"
  | "reading"
  | "listening"
  | "speaking"
  | "pronunciation"
  | "writing";

export type VocabularyStatus = "NEW" | "LEARNING" | "FAMILIAR" | "MASTERED";

export type LessonStepType =
  | "introduction"
  | "vocabulary"
  | "listening"
  | "reading"
  | "comprehension"
  | "grammar"
  | "exercise"
  | "speaking"
  | "review";

export interface MasteryScores {
  vocabulary: number;
  grammar: number;
  reading: number;
  listening: number;
  speaking: number;
  pronunciation: number;
  writing: number;
}

export interface DailyActivity {
  id: string;
  skill: SkillKey;
  title: string;
  minutes: number;
  href: string;
  reason: string;
  /** Phase 3 activity kind for UI / routing */
  kind?: DailyActivityKind;
  priority?: number;
  focus?: string;
}

export type DailyActivityKind =
  | "review"
  | "reading"
  | "comprehension"
  | "vocabulary"
  | "expressions"
  | "grammar"
  | "listening"
  | "speaking"
  | "writing"
  | "practice";

export type LessonOutcomeQuality =
  | "strong"
  | "adequate"
  | "struggling"
  | "completed";

export interface LearningProfileDTO {
  currentLevel: CEFRLevel;
  subLevel: number;
  masteryScores: MasteryScores;
  knownWordIds: string[];
  weakWordIds: string[];
  acquiredGrammarTopics: string[];
  problematicGrammarTopics: string[];
  studiedTopics: string[];
  topicsToConsolidate: string[];
}

export interface UserProgressDTO {
  xp: number;
  streak: number;
  longestStreak: number;
  totalStudyMinutes: number;
  lessonsCompleted: number;
  wordsLearned: number;
}

export interface StepResult {
  stepId: string;
  type: LessonStepType;
  score: number;
  mistakes?: string[];
  completedAt: string;
}