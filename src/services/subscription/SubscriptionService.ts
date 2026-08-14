import { prisma } from "@/lib/prisma";
import type { SubscriptionDTO, SubscriptionPlan } from "@/types/gamification";
import {
  authorizeContentAccess,
  type ContentAccessDecision,
} from "@/lib/contentAccess";

/** Free-plan daily caps — used by canStartConversation and product copy. */
export const FREE_DAILY_TUTOR_SESSIONS = 3;
export const FREE_DAILY_ROLEPLAY_SESSIONS = 2;

const PREMIUM_FEATURES = [
  "Full curriculum A2–C1",
  "Unlimited tutor & role play sessions",
  "Advanced analytics dashboard",
  "Priority cloud evaluation when AI is enabled",
];

const FREE_FEATURES = [
  "Core curriculum ZERO → A1",
  "Daily plan & spaced repetition",
  `${FREE_DAILY_TUTOR_SESSIONS} tutor sessions / day`,
  `${FREE_DAILY_ROLEPLAY_SESSIONS} role play sessions / day`,
];

export class SubscriptionService {
  async ensureSubscription(userId: string) {
    let sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub) {
      sub = await prisma.subscription.create({
        data: { userId, plan: "FREE", status: "ACTIVE" },
      });
    }
    return sub;
  }

  isPremium(plan: string, status: string, expiresAt: Date | null) {
    if (plan !== "PREMIUM" || status !== "ACTIVE") return false;
    if (expiresAt && expiresAt < new Date()) return false;
    return true;
  }

  toDTO(sub: {
    plan: string;
    status: string;
    expiresAt: Date | null;
  }): SubscriptionDTO {
    const isPremium = this.isPremium(sub.plan, sub.status, sub.expiresAt);
    return {
      plan: sub.plan as SubscriptionPlan,
      status: sub.status as SubscriptionDTO["status"],
      expiresAt: sub.expiresAt?.toISOString() || null,
      isPremium,
      features: isPremium ? PREMIUM_FEATURES : FREE_FEATURES,
    };
  }

  async getForUser(userId: string): Promise<SubscriptionDTO> {
    const sub = await this.ensureSubscription(userId);
    return this.toDTO(sub);
  }

  async upgradeToPremium(userId: string, days = 30) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const sub = await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: "PREMIUM",
        status: "ACTIVE",
        provider: "local",
        expiresAt,
      },
      update: {
        plan: "PREMIUM",
        status: "ACTIVE",
        expiresAt,
        updatedAt: new Date(),
      },
    });

    return this.toDTO(sub);
  }

  async canStartConversation(
    userId: string,
    type: "tutor" | "roleplay"
  ): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
    const sub = await this.getForUser(userId);
    if (sub.isPremium) return { allowed: true };

    const since = new Date();
    since.setHours(0, 0, 0, 0);

    // Count completed sessions only — abandoned starts do not burn Free quota.
    const todayCount = await prisma.conversationSession.count({
      where: {
        userId,
        type,
        startedAt: { gte: since },
        completedAt: { not: null },
      },
    });

    const limit =
      type === "tutor" ? FREE_DAILY_TUTOR_SESSIONS : FREE_DAILY_ROLEPLAY_SESSIONS;

    if (todayCount >= limit) {
      return {
        allowed: false,
        reason: `Free plan limit: ${limit} ${type} sessions per day. Upgrade to Premium for unlimited access.`,
        remaining: 0,
      };
    }

    return { allowed: true, remaining: limit - todayCount };
  }

  /**
   * Curriculum paywall (A2+ = Premium) combined with optional progression lock.
   * Does not change currentLevel.
   */
  async authorizeCurriculumAccess(
    userId: string,
    contentLevel: string,
    options?: { userLevel?: string | null; enforceProgression?: boolean }
  ): Promise<ContentAccessDecision> {
    const sub = await this.getForUser(userId);
    let userLevel = options?.userLevel;
    if (userLevel === undefined) {
      const lp = await prisma.learningProfile.findUnique({
        where: { userId },
        select: { currentLevel: true },
      });
      userLevel = lp?.currentLevel ?? null;
    }
    return authorizeContentAccess({
      isPremium: sub.isPremium,
      userLevel,
      contentLevel,
      enforceProgression: options?.enforceProgression,
    });
  }
}

export const subscriptionService = new SubscriptionService();
