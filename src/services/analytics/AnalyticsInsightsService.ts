import { prisma } from "@/lib/prisma";
import type { AnalyticsInsights } from "@/types/gamification";

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export class AnalyticsInsightsService {
  async getInsights(userId: string): Promise<AnalyticsInsights> {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 6);

    const [events, , lp] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where: { userId, createdAt: { gte: weekAgo } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.userProgress.findUnique({ where: { userId } }),
      prisma.learningProfile.findUnique({ where: { userId } }),
    ]);

    const dayMap = new Map<string, { count: number; minutes: number }>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekAgo);
      d.setDate(weekAgo.getDate() + i);
      dayMap.set(dateKey(d), { count: 0, minutes: 0 });
    }

    const eventTotals = new Map<string, number>();
    for (const event of events) {
      const key = dateKey(startOfDay(event.createdAt));
      const bucket = dayMap.get(key);
      if (bucket) {
        bucket.count += 1;
        bucket.minutes += 2;
      }
      eventTotals.set(event.event, (eventTotals.get(event.event) || 0) + 1);
    }

    const weeklyActivity = [...dayMap.entries()].map(([date, data]) => ({
      date,
      ...data,
    }));

    const studyMinutesThisWeek = weeklyActivity.reduce(
      (sum, d) => sum + d.minutes,
      0
    );

    const skillTrend: Record<string, number> = lp
      ? {
          vocabulary: lp.vocabularyScore,
          grammar: lp.grammarScore,
          reading: lp.readingScore,
          listening: lp.listeningScore,
          speaking: lp.speakingScore,
          pronunciation: lp.pronunciationScore,
          writing: lp.writingScore,
        }
      : {};

    return {
      weeklyActivity,
      eventBreakdown: [...eventTotals.entries()]
        .map(([event, count]) => ({ event, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      skillTrend,
      totalSessions: events.length,
      studyMinutesThisWeek,
      averageDailyMinutes: Math.round(studyMinutesThisWeek / 7),
    };
  }
}

export const analyticsInsightsService = new AnalyticsInsightsService();
