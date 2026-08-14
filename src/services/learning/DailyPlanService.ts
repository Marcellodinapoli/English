/**
 * Phase 3 Daily Plan — builds today's activities from Phase 0–2 sources.
 * Recalculated on every request (adapts within the same day).
 */
import { personalizedExerciseSources } from "@/services/learning/PersonalizedExerciseSourceService";
import { contentService } from "@/services/content/ContentService";
import { subscriptionService } from "@/services/subscription/SubscriptionService";
import { maxAccessibleContentLevel } from "@/lib/contentAccess";
import { curriculumHrefRequiresPremium } from "@/lib/contentGate";
import type {
  DailyActivity,
  SkillKey,
} from "@/types/learning";
import type { RankedExerciseTarget } from "@/types/practice";
import type { PersonalizedExerciseSources } from "@/services/learning/PersonalizedExerciseSourceService";

export interface DailyPlanResult {
  plan: DailyActivity[];
  recommended: DailyActivity;
  dueReviewCount: number;
  primaryWeakness: string;
  weakestSkills: string[];
  sourcesSummary: {
    targetCount: number;
    topKinds: string[];
  };
  goalHint: string;
}

function skillKey(skill: string): SkillKey {
  const allowed: SkillKey[] = [
    "vocabulary",
    "grammar",
    "reading",
    "listening",
    "speaking",
    "pronunciation",
    "writing",
  ];
  if (allowed.includes(skill as SkillKey)) return skill as SkillKey;
  if (skill === "expression") return "vocabulary";
  return "vocabulary";
}

function practiceHref(skill: string, focus?: string) {
  const params = new URLSearchParams();
  if (skill) params.set("skill", skill);
  if (focus) params.set("focus", focus);
  const q = params.toString();
  return q ? `/practice?${q}` : "/practice";
}

function activityFromTarget(
  target: RankedExerciseTarget,
  _sources: PersonalizedExerciseSources,
  planLevel: string,
  isPremium: boolean
): DailyActivity | null {
  const level = planLevel;

  if (target.kind === "due_review" || target.itemType === "MISTAKE" && target.due) {
    return {
      id: `review-${target.itemId}`,
      kind: "review",
      skill: skillKey(target.skill),
      title: "Smart Review",
      minutes: 5,
      href: "/review",
      reason: target.reasons[0] || "Items are due now",
      priority: target.priority,
      focus: target.label,
    };
  }

  if (target.itemType === "EXPRESSION" || target.kind === "low_mastery_expression") {
    return {
      id: `expr-${target.itemId}`,
      kind: "expressions",
      skill: "vocabulary",
      title: "Expression practice",
      minutes: 6,
      href: practiceHref("expression", target.label),
      reason: target.reasons[0] || `Strengthen “${target.label}”`,
      priority: target.priority,
      focus: target.label,
    };
  }

  if (target.itemType === "VOCABULARY" || target.kind === "low_mastery_word" || target.kind === "recent_save") {
    return {
      id: `vocab-${target.itemId}`,
      kind: "vocabulary",
      skill: "vocabulary",
      title: "Vocabulary practice",
      minutes: 6,
      href: practiceHref("vocabulary", target.label),
      reason: target.reasons[0] || `Review “${target.label}”`,
      priority: target.priority,
      focus: target.label,
    };
  }

  if (target.itemType === "GRAMMAR" || target.kind === "grammar_weakness") {
    const topic =
      contentService.getGrammar(target.itemId) ||
      contentService.listGrammar().find((g) =>
        g.level.toUpperCase().startsWith(level.toUpperCase())
      );
    const href = topic
      ? `/grammar/${topic.id}`
      : practiceHref("grammar", target.label);
    return {
      id: `grammar-${target.itemId}`,
      kind: "grammar",
      skill: "grammar",
      title: topic?.title || "Grammar focus",
      minutes: 8,
      href: curriculumHrefRequiresPremium(href, isPremium)
        ? practiceHref("grammar", target.label)
        : href,
      reason: target.reasons[0] || "Grammar needs reinforcement",
      priority: target.priority,
      focus: target.label,
    };
  }

  if (target.itemType === "MISTAKE") {
    if (target.skill === "reading") {
      const requested =
        contentService.getPassage(String(target.payload.contentRef || ""));
      const passage =
        requested &&
        !curriculumHrefRequiresPremium(`/read/${requested.id}`, isPremium)
          ? requested
          : contentService.listPassages().find((p) =>
              p.level.toUpperCase().startsWith(level.toUpperCase())
            );
      return {
        id: `read-mistake-${target.itemId}`,
        kind: "comprehension",
        skill: "reading",
        title: "Reading comprehension",
        minutes: 8,
        href: passage ? `/read/${passage.id}` : practiceHref("reading"),
        reason: target.reasons[0] || "Reading errors to fix",
        priority: target.priority,
        focus: "reading",
      };
    }
    if (target.skill === "grammar") {
      return {
        id: `gr-mistake-${target.itemId}`,
        kind: "practice",
        skill: "grammar",
        title: "Grammar practice",
        minutes: 7,
        href: practiceHref("grammar"),
        reason: target.reasons[0] || "Repeated grammar mistakes",
        priority: target.priority,
        focus: "grammar",
      };
    }
    if (target.skill === "listening") {
      const requested = contentService.getListening(
        String(target.payload.contentRef || "")
      );
      const listening =
        requested &&
        !curriculumHrefRequiresPremium(`/listen/${requested.id}`, isPremium)
          ? requested
          : contentService.getListeningForLevel(level);
      return {
        id: `listen-mistake-${target.itemId}`,
        kind: "listening",
        skill: "listening",
        title: listening?.title || "Listening practice",
        minutes: 8,
        href: listening ? `/listen/${listening.id}` : "/listen",
        reason: target.reasons[0] || "Listening errors to fix",
        priority: target.priority,
        focus: "listening",
      };
    }
    if (target.skill === "speaking" || target.skill === "pronunciation") {
      const speaking = contentService.getSpeakingForLevel(level);
      const roleplay = contentService.getRoleplayForLevel(level);
      // Prefer Review when the mistake is already due; otherwise real speaking surface.
      if (target.due) {
        return {
          id: `speak-mistake-review-${target.itemId}`,
          kind: "review",
          skill: "speaking",
          title: "Review speaking mistakes",
          minutes: 5,
          href: "/review",
          reason: target.reasons[0] || "Speaking mistakes are due",
          priority: target.priority,
          focus: "speaking",
        };
      }
      return {
        id: `speak-mistake-${target.itemId}`,
        kind: "speaking",
        skill: "speaking",
        title: roleplay?.title || speaking?.title || "Speaking practice",
        minutes: 8,
        href: roleplay
          ? `/real-life/${roleplay.id}`
          : speaking
            ? `/speak/${speaking.id}`
            : "/speak",
        reason: target.reasons[0] || "Speaking errors to fix",
        priority: target.priority,
        focus: "speaking",
      };
    }
    if (target.skill === "writing") {
      const writing =
        contentService.listWriting().find((w) =>
          w.level.toUpperCase().startsWith(level.toUpperCase())
        ) || contentService.listWriting()[0];
      return {
        id: `write-mistake-${target.itemId}`,
        kind: "writing",
        skill: "writing",
        title: writing?.title || "Writing practice",
        minutes: 8,
        href: writing ? `/speak/write/${writing.id}` : "/speak",
        reason: target.reasons[0] || "Writing errors to fix",
        priority: target.priority,
        focus: "writing",
      };
    }
    // Remaining mistake skills with RuleBased support → practice; else Review.
    if (target.skill === "vocabulary" || target.skill === "expression") {
      return {
        id: `prac-mistake-${target.itemId}`,
        kind: "practice",
        skill: skillKey(target.skill),
        title: "Personalized practice",
        minutes: 7,
        href: practiceHref(target.skill, target.label),
        reason: target.reasons[0] || "Targeted practice from your errors",
        priority: target.priority,
        focus: target.skill,
      };
    }
    return {
      id: `review-mistake-${target.itemId}`,
      kind: "review",
      skill: skillKey(target.skill),
      title: "Smart Review",
      minutes: 5,
      href: "/review",
      reason: target.reasons[0] || "Review your mistakes",
      priority: target.priority,
      focus: target.skill,
    };
  }

  if (target.kind === "skill_weakness" || target.itemType === "SKILL") {
    const skill = target.skill;
    if (skill === "listening") {
      const listening = contentService.getListeningForLevel(level);
      return {
        id: `listen-${skill}`,
        kind: "listening",
        skill: "listening",
        title: listening?.title || "Listening",
        minutes: 8,
        href: listening ? `/listen/${listening.id}` : "/listen",
        reason: target.reasons[0] || "Listening is a weak skill",
        priority: target.priority,
      };
    }
    if (skill === "speaking" || skill === "pronunciation") {
      const speaking = contentService.getSpeakingForLevel(level);
      const roleplay = contentService.getRoleplayForLevel(level);
      return {
        id: `speak-${skill}`,
        kind: "speaking",
        skill: "speaking",
        title: roleplay?.title || speaking?.title || "Speaking",
        minutes: 8,
        href: roleplay
          ? `/real-life/${roleplay.id}`
          : speaking
            ? `/speak/${speaking.id}`
            : "/speak",
        reason: target.reasons[0] || "Speaking needs practice",
        priority: target.priority,
      };
    }
    if (skill === "writing") {
      const writing =
        contentService.listWriting().find((w) =>
          w.level.toUpperCase().startsWith(level.toUpperCase())
        ) || contentService.listWriting()[0];
      return {
        id: `write-${skill}`,
        kind: "writing",
        skill: "writing",
        title: writing?.title || "Writing",
        minutes: 8,
        href: writing ? `/speak/write/${writing.id}` : "/speak",
        reason: target.reasons[0] || "Writing is a weak skill",
        priority: target.priority,
      };
    }
    if (skill === "reading") {
      const passage = contentService.listPassages().find((p) =>
        p.level.toUpperCase().startsWith(level.toUpperCase())
      );
      return {
        id: `read-skill`,
        kind: "comprehension",
        skill: "reading",
        title: passage ? `Read: ${passage.title}` : "Reading",
        minutes: 10,
        href: passage ? `/read/${passage.id}` : "/read",
        reason: target.reasons[0] || "Reading comprehension needs work",
        priority: target.priority,
      };
    }
    if (skill === "grammar") {
      return {
        id: `practice-grammar-skill`,
        kind: "practice",
        skill: "grammar",
        title: "Grammar practice",
        minutes: 7,
        href: practiceHref("grammar"),
        reason: target.reasons[0] || "Grammar skill is weak",
        priority: target.priority,
      };
    }
    if (skill === "vocabulary") {
      return {
        id: `practice-vocab-skill`,
        kind: "vocabulary",
        skill: "vocabulary",
        title: "Vocabulary practice",
        minutes: 6,
        href: practiceHref("vocabulary"),
        reason: target.reasons[0] || "Vocabulary skill is weak",
        priority: target.priority,
      };
    }
  }

  if (target.kind === "new_content" || target.itemType === "CONTENT") {
    const passageId = String(target.payload.passageId || target.itemId);
    const requested = contentService.getPassage(passageId);
    const passage =
      requested &&
      !curriculumHrefRequiresPremium(`/read/${requested.id}`, isPremium)
        ? requested
        : contentService.listPassages().find((p) =>
            p.level.toUpperCase().startsWith(level.toUpperCase())
          );
    return {
      id: `content-${passageId}`,
      kind: "reading",
      skill: "reading",
      title: passage ? `New: ${passage.title}` : "New reading",
      minutes: 10,
      href: passage ? `/read/${passage.id}` : "/learn",
      reason: target.reasons[0] || "New content for your level",
      priority: target.priority,
    };
  }

  return null;
}

function dedupePlan(items: DailyActivity[]): DailyActivity[] {
  const seen = new Set<string>();
  const out: DailyActivity[] = [];
  for (const item of items) {
    const key = item.kind || item.href;
    if (seen.has(key)) {
      // Keep higher priority entry
      const idx = out.findIndex((x) => (x.kind || x.href) === key);
      if (idx >= 0 && (item.priority || 0) > (out[idx].priority || 0)) {
        out[idx] = item;
      }
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

function allocateMinutes(
  activities: DailyActivity[],
  dailyMinutes: number
): DailyActivity[] {
  const budget = Math.max(15, dailyMinutes);
  const capped = activities.slice(0, 5);
  if (!capped.length) return capped;
  const total = capped.reduce((s, a) => s + a.minutes, 0);
  if (total <= budget) return capped;
  const scale = budget / total;
  return capped.map((a) => ({
    ...a,
    minutes: Math.max(3, Math.round(a.minutes * scale)),
  }));
}

export class DailyPlanService {
  async build(userId: string, dailyMinutes: number): Promise<DailyPlanResult> {
    const sources = await personalizedExerciseSources.collect(userId);
    const sub = await subscriptionService.getForUser(userId);
    const isPremium = sub.isPremium;
    const planLevel = maxAccessibleContentLevel(
      isPremium,
      sources.currentLevel
    );
    const activities: DailyActivity[] = [];

    // Always surface due reviews first if any
    if (sources.dueReviews.length > 0) {
      activities.push({
        id: "daily-review-queue",
        kind: "review",
        skill: "vocabulary",
        title: "Smart Review",
        minutes: Math.min(8, Math.max(3, sources.dueReviews.length)),
        href: "/review",
        reason: `${sources.dueReviews.length} review item${
          sources.dueReviews.length === 1 ? "" : "s"
        } due now`,
        priority: 200,
      });
    }

    for (const target of sources.targets) {
      const activity = activityFromTarget(
        target,
        sources,
        planLevel,
        isPremium
      );
      if (activity) activities.push(activity);
      if (activities.length >= 12) break;
    }

    // Ensure at least one learning path if empty
    if (!activities.length) {
      const lesson = contentService.getFirstLessonForLevel(planLevel);
      const href = lesson
        ? `/learn/${lesson.levelId}/${lesson.unitId}/${lesson.id}`
        : "/learn";
      activities.push({
        id: "daily-learn",
        kind: "reading",
        skill: "reading",
        title: lesson?.title || "Continue learning",
        minutes: Math.max(10, Math.round(dailyMinutes * 0.5)),
        href:
          curriculumHrefRequiresPremium(href, isPremium) ? "/learn" : href,
        reason: "Keep building your level path",
        priority: 5,
      });
    }

    const accessible = activities.filter(
      (a) => !curriculumHrefRequiresPremium(a.href, isPremium)
    );
    const plan = allocateMinutes(
      dedupePlan(
        accessible.length
          ? accessible
          : [
              {
                id: "daily-fallback",
                kind: "review" as const,
                skill: "vocabulary" as const,
                title: "Smart Review",
                minutes: 5,
                href: "/review",
                reason:
                  "Keep practising with reviews available on your plan",
                priority: 1,
              },
            ]
      ),
      dailyMinutes
    );
    const recommended = plan[0];
    const primaryWeakness =
      sources.weakestSkills[0] ||
      recommended?.skill ||
      "vocabulary";

    return {
      plan,
      recommended,
      dueReviewCount: sources.dueReviews.length,
      primaryWeakness,
      weakestSkills: sources.weakestSkills,
      sourcesSummary: {
        targetCount: sources.targets.length,
        topKinds: sources.targets.slice(0, 5).map((t) => t.kind),
      },
      goalHint: recommended.reason,
    };
  }
}

export const dailyPlanService = new DailyPlanService();
