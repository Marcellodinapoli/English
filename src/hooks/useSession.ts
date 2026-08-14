"use client";

import { useQuery } from "@tanstack/react-query";
import type { SubscriptionDTO } from "@/types/gamification";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session");
      if (!res.ok) throw new Error("Failed to load session");
      return res.json() as Promise<{
        aiOperational?: boolean;
        user: null | {
          id: string;
          email: string;
          name: string;
          role?: string;
          subscription?: SubscriptionDTO;
          profile: {
            onboardingDone: boolean;
            assessmentDone: boolean;
            dailyMinutes: number;
            goal: string;
            focusSkills: string;
          } | null;
          learningProfile: {
            currentLevel: string;
            subLevel: number;
            vocabularyScore: number;
            grammarScore: number;
            readingScore: number;
            listeningScore: number;
            speakingScore: number;
            pronunciationScore: number;
            writingScore: number;
          } | null;
          progress: {
            xp: number;
            streak: number;
            longestStreak: number;
            totalStudyMinutes: number;
            lessonsCompleted: number;
            wordsLearned: number;
          } | null;
        };
      }>;
    },
  });
}