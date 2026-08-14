import fs from "fs";
import path from "path";
import type {
  AchievementDefinition,
  MilestoneDefinition,
} from "@/types/gamification";

const FILE = path.join(process.cwd(), "content", "achievements.json");

export function getAchievementCatalog(): {
  achievements: AchievementDefinition[];
  milestones: MilestoneDefinition[];
} {
  const raw = fs.readFileSync(/* turbopackIgnore: true */ FILE, "utf-8");
  return JSON.parse(raw) as {
    achievements: AchievementDefinition[];
    milestones: MilestoneDefinition[];
  };
}

export function getAchievementById(id: string): AchievementDefinition | null {
  return getAchievementCatalog().achievements.find((a) => a.id === id) ?? null;
}
