"use client";

import type { ComponentType } from "react";
import {
  BookOpen,
  Bot,
  Flame,
  Globe,
  Library,
  Mic,
  RefreshCw,
  Sparkles,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AchievementDefinition } from "@/types/gamification";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  book: BookOpen,
  library: Library,
  refresh: RefreshCw,
  flame: Flame,
  mic: Mic,
  globe: Globe,
  bot: Bot,
  star: Star,
};

export function AchievementBadge({
  achievement,
  unlocked,
  size = "md",
}: {
  achievement: AchievementDefinition;
  unlocked: boolean;
  size?: "sm" | "md";
}) {
  const Icon = ICONS[achievement.icon] || Star;

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border p-4 text-center transition",
        unlocked
          ? "border-teal/30 bg-teal-soft/40"
          : "border-line bg-sand/30 opacity-60 grayscale"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full",
          unlocked ? "bg-teal text-white" : "bg-sand text-muted",
          size === "sm" ? "h-10 w-10" : "h-12 w-12"
        )}
      >
        <Icon className={size === "sm" ? "h-5 w-5" : "h-6 w-6"} />
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">{achievement.titleIt}</p>
      <p className="mt-1 text-xs text-muted">{achievement.descriptionIt}</p>
      {unlocked ? (
        <p className="mt-2 text-xs font-medium text-teal-deep">
          +{achievement.xpReward} XP
        </p>
      ) : null}
    </div>
  );
}
