import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { achievementEngine } from "@/services/gamification/AchievementEngine";
import { getAchievementCatalog } from "@/services/gamification/achievementCatalog";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.progress || !user.learningProfile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { milestones } = getAchievementCatalog();
  const items = await achievementEngine.getUserAchievements(user.id);
  const milestoneProgress = achievementEngine.getMilestoneProgress(milestones, {
    level: user.learningProfile.currentLevel,
    streak: user.progress.streak,
    xp: user.progress.xp,
    studyMinutes: user.progress.totalStudyMinutes,
  });

  const unlocked = items.filter((i) => i.unlocked).length;

  return NextResponse.json({
    achievements: items,
    milestones: milestoneProgress,
    summary: {
      unlocked,
      total: items.length,
      xp: user.progress.xp,
      streak: user.progress.streak,
    },
  });
}
