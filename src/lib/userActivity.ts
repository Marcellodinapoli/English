import { prisma } from "@/lib/prisma";

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Updates streak, study time and optional XP on every learning activity.
 */
export async function recordUserActivity(
  userId: string,
  options: { studyMinutes?: number; xp?: number } = {}
) {
  const progress = await prisma.userProgress.findUnique({ where: { userId } });
  if (!progress) return null;

  const now = new Date();
  const today = startOfDay(now);
  const lastActive = progress.lastActiveDate
    ? startOfDay(progress.lastActiveDate)
    : null;

  let streak = progress.streak;
  if (!lastActive) {
    streak = 1;
  } else {
    const diffDays = Math.floor(
      (today.getTime() - lastActive.getTime()) / 86_400_000
    );
    if (diffDays === 1) streak += 1;
    else if (diffDays > 1) streak = 1;
  }

  const longestStreak = Math.max(progress.longestStreak, streak);

  return prisma.userProgress.update({
    where: { userId },
    data: {
      lastActiveDate: now,
      streak,
      longestStreak,
      totalStudyMinutes: {
        increment: options.studyMinutes ?? 0,
      },
      ...(options.xp ? { xp: { increment: options.xp } } : {}),
    },
  });
}
