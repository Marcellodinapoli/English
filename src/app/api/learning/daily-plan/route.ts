import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  FREE_MAX_CONTENT_LEVEL,
  isPremiumRequiredForLevel,
  maxAccessibleContentLevel,
} from "@/lib/contentAccess";
import { levelIndex } from "@/lib/cefr";
import type { CEFRLevel, LearningProfileDTO } from "@/types/learning";
import { dailyPlanService } from "@/services/learning/DailyPlanService";
import { toLearningProfileDTO } from "@/lib/learningProfile";
import { subscriptionService } from "@/services/subscription/SubscriptionService";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.learningProfile || !user.progress || !user.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lp = user.learningProfile;
  const profile: LearningProfileDTO = toLearningProfileDTO({
    currentLevel: lp.currentLevel,
    subLevel: lp.subLevel,
    vocabularyScore: lp.vocabularyScore,
    grammarScore: lp.grammarScore,
    readingScore: lp.readingScore,
    listeningScore: lp.listeningScore,
    speakingScore: lp.speakingScore,
    pronunciationScore: lp.pronunciationScore,
    writingScore: lp.writingScore,
    knownWordIds: lp.knownWordIds,
    weakWordIds: lp.weakWordIds,
    acquiredGrammarTopics: lp.acquiredGrammarTopics,
    problematicGrammarTopics: lp.problematicGrammarTopics,
    studiedTopics: lp.studiedTopics,
    topicsToConsolidate: lp.topicsToConsolidate,
  });

  // Recalculated every request — adapts within the same day
  const built = await dailyPlanService.build(
    user.id,
    user.profile.dailyMinutes
  );
  const subscription = await subscriptionService.getForUser(user.id);
  const accessibleContentLevel = maxAccessibleContentLevel(
    subscription.isPremium,
    lp.currentLevel
  );
  const reachedIndex = levelIndex(accessibleContentLevel);
  const freeAtCurriculumCap =
    !subscription.isPremium &&
    reachedIndex >= levelIndex(FREE_MAX_CONTENT_LEVEL);
  const freeLevelBeyondContent =
    !subscription.isPremium && isPremiumRequiredForLevel(lp.currentLevel);

  return NextResponse.json({
    plan: built.plan,
    weakest: built.primaryWeakness,
    weakestSkills: built.weakestSkills,
    dueReviewCount: built.dueReviewCount,
    recommendedLesson: {
      id: built.recommended.id,
      title: built.recommended.title,
      href: built.recommended.href,
      reason: built.recommended.reason,
      kind: built.recommended.kind,
    },
    nextBest: built.recommended,
    sourcesSummary: built.sourcesSummary,
    goalHint: built.goalHint,
    progress: user.progress,
    profile,
    goal: user.profile.goal,
    level: lp.currentLevel as CEFRLevel,
    subscription: {
      isPremium: subscription.isPremium,
      plan: subscription.plan,
    },
    freeCurriculum: {
      maxContentLevel: FREE_MAX_CONTENT_LEVEL,
      accessibleContentLevel,
      atCap: freeAtCurriculumCap,
      levelBeyondContent: freeLevelBeyondContent,
    },
  });
}
