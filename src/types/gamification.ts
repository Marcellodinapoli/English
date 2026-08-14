export type AchievementCategory =
  | "learning"
  | "vocabulary"
  | "review"
  | "consistency"
  | "speaking"
  | "conversation"
  | "progress";

export type AchievementCondition =
  | { type: "lessons_completed"; value: number }
  | { type: "words_learned"; value: number }
  | { type: "reviews_completed"; value: number }
  | { type: "streak"; value: number }
  | { type: "xp"; value: number }
  | { type: "event_count"; event: string; value: number };

export interface AchievementDefinition {
  id: string;
  title: string;
  titleIt: string;
  description: string;
  descriptionIt: string;
  icon: string;
  category: AchievementCategory;
  xpReward: number;
  condition: AchievementCondition;
}

export type MilestoneType = "level" | "streak" | "xp" | "study_minutes";

export interface MilestoneDefinition {
  id: string;
  title: string;
  titleIt: string;
  description: string;
  type: MilestoneType;
  value: string | number;
  order: number;
}

export interface UserAchievementDTO {
  achievementId: string;
  unlockedAt: string;
  achievement: AchievementDefinition;
}

export interface MilestoneProgressDTO {
  milestone: MilestoneDefinition;
  reached: boolean;
  progress: number;
  target: number;
}

export type SubscriptionPlan = "FREE" | "PREMIUM";
export type SubscriptionStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "TRIAL";

export interface SubscriptionDTO {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  expiresAt: string | null;
  isPremium: boolean;
  features: string[];
}

export interface AnalyticsInsights {
  weeklyActivity: Array<{ date: string; count: number; minutes: number }>;
  eventBreakdown: Array<{ event: string; count: number }>;
  skillTrend: Record<string, number>;
  totalSessions: number;
  studyMinutesThisWeek: number;
  averageDailyMinutes: number;
}
