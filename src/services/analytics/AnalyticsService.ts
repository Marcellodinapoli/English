import { prisma } from "@/lib/prisma";

export type AnalyticsEventName =
  | "lesson_started"
  | "lesson_completed"
  | "word_clicked"
  | "word_saved"
  | "word_reviewed"
  | "expression_clicked"
  | "expression_saved"
  | "exercise_completed"
  | "mistake_created"
  | "speaking_started"
  | "speaking_completed"
  | "roleplay_started"
  | "roleplay_completed"
  | "tutor_started"
  | "tutor_completed"
  | "subscription_upgraded"
  | "level_promoted"
  | "assessment_completed"
  | "onboarding_completed";

export class AnalyticsService {
  async track(
    userId: string,
    event: AnalyticsEventName,
    metadata?: Record<string, unknown>
  ) {
    await prisma.analyticsEvent.create({
      data: {
        userId,
        event,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  }
}

export const analyticsService = new AnalyticsService();