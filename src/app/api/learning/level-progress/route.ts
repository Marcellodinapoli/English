import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { levelProgressionEngine } from "@/services/learning/LevelProgressionEngine";
import { LEVEL_PROGRESSION_THRESHOLDS } from "@/lib/levelProgressionThresholds";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.learningProfile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await levelProgressionEngine.getStatus(user.id);
  const t = LEVEL_PROGRESSION_THRESHOLDS;

  let promotionHint: string;
  if (status.blockers.includes("Complete all lessons in this level")) {
    promotionHint = `Complete all ${status.lessonsTotalInLevel} lessons at ${status.currentLevel} to advance.`;
  } else if (status.averageMastery < t.masteryMin) {
    promotionHint = `Raise vocabulary, grammar, reading and listening scores to ${t.masteryMin}+.`;
  } else if (status.blockers.length > 0) {
    promotionHint = status.blockers[0];
  } else if (status.readyToPromote) {
    promotionHint =
      "You are ready for the next level — finish your last lesson to promote.";
  } else {
    promotionHint = "You are at the highest level.";
  }

  return NextResponse.json({
    currentLevel: status.currentLevel,
    subLevel: status.subLevel,
    nextLevel: levelProgressionEngine.nextLevel(status.currentLevel),
    lessonsCompletedInLevel: status.lessonsCompletedInLevel,
    lessonsTotalInLevel: status.lessonsTotalInLevel,
    levelProgressPercent: status.levelProgressPercent,
    averageMastery: status.averageMastery,
    readyToPromote: status.readyToPromote,
    blockers: status.blockers,
    thresholds: t,
    promotionHint,
  });
}
