import { NextResponse } from "next/server";
import { getCurrentUser, parseJsonArray } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  FREE_MAX_CONTENT_LEVEL,
  isPremiumRequiredForLevel,
  maxAccessibleContentLevel,
} from "@/lib/contentAccess";
import { levelIndex } from "@/lib/cefr";
import { adaptiveEngine } from "@/services/learning/AdaptiveEngine";
import { dailyPlanService } from "@/services/learning/DailyPlanService";
import { achievementEngine } from "@/services/gamification/AchievementEngine";
import { getAchievementCatalog } from "@/services/gamification/achievementCatalog";
import { analyticsInsightsService } from "@/services/analytics/AnalyticsInsightsService";
import { subscriptionService } from "@/services/subscription/SubscriptionService";
import type { CEFRLevel } from "@/types/learning";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.learningProfile || !user.progress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lp = user.learningProfile;
  const scores = {
    vocabulary: lp.vocabularyScore,
    grammar: lp.grammarScore,
    reading: lp.readingScore,
    listening: lp.listeningScore,
    speaking: lp.speakingScore,
    pronunciation: lp.pronunciationScore,
    writing: lp.writingScore,
  };

  const dueReviewCount = await prisma.reviewItem.count({
    where: { userId: user.id, nextReviewAt: { lte: new Date() } },
  });

  const openMistakes = await prisma.userMistake.count({
    where: { userId: user.id, resolved: false },
  });

  const { milestones } = getAchievementCatalog();
  const achievementItems = await achievementEngine.getUserAchievements(user.id);
  const milestoneProgress = achievementEngine.getMilestoneProgress(milestones, {
    level: lp.currentLevel,
    streak: user.progress.streak,
    xp: user.progress.xp,
    studyMinutes: user.progress.totalStudyMinutes,
  });
  const subscription = await subscriptionService.getForUser(user.id);
  // Match /api/analytics/insights Premium policy — do not leak advanced analytics to Free.
  const insights = subscription.isPremium
    ? await analyticsInsightsService.getInsights(user.id)
    : null;

  const dailyMinutes = user.profile?.dailyMinutes || 15;
  // Single source of truth with Home / lesson-complete (DailyPlanService).
  const plan = await dailyPlanService.build(user.id, dailyMinutes);
  const contentCap = maxAccessibleContentLevel(
    subscription.isPremium,
    lp.currentLevel
  );
  const freeCurriculumCeiling =
    !subscription.isPremium &&
    isPremiumRequiredForLevel(lp.currentLevel);
  const freeAtCurriculumCap =
    !subscription.isPremium &&
    levelIndex(contentCap) >= levelIndex(FREE_MAX_CONTENT_LEVEL);

  return NextResponse.json({
    level: lp.currentLevel as CEFRLevel,
    subLevel: lp.subLevel,
    scores,
    weakest: plan.primaryWeakness || adaptiveEngine.getWeakestSkill(scores),
    dueReviewCount,
    openMistakes,
    recommended: plan.recommended,
    planGoalHint: plan.goalHint,
    freeCurriculum: {
      maxContentLevel: FREE_MAX_CONTENT_LEVEL,
      accessibleContentLevel: contentCap,
      atCap: freeAtCurriculumCap,
      levelBeyondContent: freeCurriculumCeiling,
    },
    progress: user.progress,
    goal: user.profile?.goal || "",
    problematicGrammar: parseJsonArray(lp.problematicGrammarTopics),
    achievements: {
      unlocked: achievementItems.filter((a) => a.unlocked).length,
      total: achievementItems.length,
      recent: achievementItems.filter((a) => a.unlocked).slice(0, 3),
    },
    milestones: milestoneProgress,
    analytics: insights,
    subscription,
  });
}
