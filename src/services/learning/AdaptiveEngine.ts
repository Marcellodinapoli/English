import type {
  DailyActivity,
  LearningProfileDTO,
  MasteryScores,
  SkillKey,
} from "@/types/learning";

const SKILL_LABELS: Record<SkillKey, string> = {
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  reading: "Reading",
  listening: "Listening",
  speaking: "Speaking",
  pronunciation: "Pronunciation",
  writing: "Writing",
};

export class AdaptiveEngine {
  getWeakestSkill(
    scores: MasteryScores,
    options?: { pronunciationEvaluated?: boolean }
  ): SkillKey {
    const ranked = (Object.entries(scores) as [SkillKey, number][])
      .filter(
        ([k]) => k !== "pronunciation" || options?.pronunciationEvaluated === true
      )
      .sort((a, b) => a[1] - b[1]);
    return ranked[0][0];
  }

  getStrongestSkill(scores: MasteryScores): SkillKey {
    return (Object.entries(scores) as [SkillKey, number][]).sort(
      (a, b) => b[1] - a[1]
    )[0][0];
  }

  updateMastery(current: number, accuracy: number, weight = 0.3): number {
    const next = current * (1 - weight) + accuracy * 100 * weight;
    return Math.round(Math.min(100, Math.max(0, next)) * 10) / 10;
  }

  hrefFor(skill: SkillKey): string {
    switch (skill) {
      case "reading":
        return "/read";
      case "listening":
        return "/listen";
      case "vocabulary":
        return "/vocabulary";
      case "grammar":
        return "/grammar";
      case "speaking":
      case "pronunciation":
        return "/real-life";
      case "writing":
        return "/speak";
      default:
        return "/learn";
    }
  }

  /**
   * Prefer skills that have a live practice surface.
   */
  availableSkills(): SkillKey[] {
    return [
      "listening",
      "grammar",
      "reading",
      "vocabulary",
      "writing",
      "speaking",
      "pronunciation",
    ];
  }

  pickSkills(
    scores: MasteryScores,
    options?: { pronunciationEvaluated?: boolean }
  ): SkillKey[] {
    const available = this.availableSkills();
    const ranked = (Object.entries(scores) as [SkillKey, number][])
      .filter(([k]) => available.includes(k))
      .filter(
        ([k]) => k !== "pronunciation" || options?.pronunciationEvaluated === true
      )
      .sort((a, b) => a[1] - b[1]);

    const weak = ranked.filter(([, v]) => v < 65).map(([k]) => k);
    const medium = ranked.filter(([, v]) => v >= 65 && v < 85).map(([k]) => k);
    const selected: SkillKey[] = [];

    for (const skill of [...weak, ...medium, ...ranked.map(([k]) => k)]) {
      if (!selected.includes(skill)) selected.push(skill);
      if (selected.length >= 4) break;
    }

    if (!selected.includes("reading") && scores.reading < 92) {
      if (selected.length >= 4) selected[selected.length - 1] = "reading";
      else selected.push("reading");
    }

    return selected;
  }

  getWeakestAvailableSkill(
    scores: MasteryScores,
    options?: { pronunciationEvaluated?: boolean }
  ): SkillKey {
    const available = this.availableSkills();
    return (Object.entries(scores) as [SkillKey, number][])
      .filter(([k]) => available.includes(k))
      .filter(
        ([k]) => k !== "pronunciation" || options?.pronunciationEvaluated === true
      )
      .sort((a, b) => a[1] - b[1])[0][0];
  }

  /**
   * Legacy helper — Progress / Home recommendations use DailyPlanService.
   * Kept for skill-pick helpers and any explicit callers of generateDailyPlan.
   */
  generateDailyPlan(
    profile: LearningProfileDTO,
    dailyMinutes: number,
    options?: { dueReviewCount?: number }
  ): DailyActivity[] {
    const scores = profile.masteryScores;
    const weakest = this.getWeakestAvailableSkill(scores);
    const picked = this.pickSkills(scores);
    const planMinutes = Math.max(15, dailyMinutes);
    const dueReviewCount = options?.dueReviewCount ?? 0;

    const activities: DailyActivity[] = [];

    if (dueReviewCount > 0) {
      activities.push({
        id: "daily-review",
        skill: "vocabulary",
        title: "Smart Review",
        minutes: Math.min(5, Math.max(2, dueReviewCount)),
        href: "/review",
        reason: `${dueReviewCount} item${dueReviewCount === 1 ? "" : "s"} due now`,
      });
    }

    const remainingMinutes =
      planMinutes - activities.reduce((sum, a) => sum + a.minutes, 0);
    const weights = [0.4, 0.25, 0.2, 0.15];

    picked.slice(0, 4 - activities.length).forEach((skill, i) => {
      activities.push({
        id: `daily-${i}-${skill}`,
        skill,
        title: SKILL_LABELS[skill],
        minutes: Math.max(3, Math.round(remainingMinutes * (weights[i] || 0.15))),
        href: this.hrefFor(skill),
        reason:
          skill === weakest
            ? "Priority: your weakest skill today"
            : scores[skill] > 85
              ? "Light reinforcement"
              : "Balanced practice for steady progress",
      });
    });

    return activities;
  }

  recommendNextActivity(
    profile: LearningProfileDTO,
    dueReviewCount = 0
  ): DailyActivity {
    return this.generateDailyPlan(profile, 15, { dueReviewCount })[0];
  }

  shouldDeprioritize(skill: SkillKey, scores: MasteryScores): boolean {
    return scores[skill] >= 85 && this.getWeakestSkill(scores) !== skill;
  }
}

export const adaptiveEngine = new AdaptiveEngine();
