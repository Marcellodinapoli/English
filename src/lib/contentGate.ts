import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { contentService } from "@/services/content/ContentService";
import { subscriptionService } from "@/services/subscription/SubscriptionService";
import {
  authorizeContentAccess,
  catalogLockMeta,
  isPremiumRequiredForLevel,
  type ContentAccessDecision,
} from "@/lib/contentAccess";

type AuthedUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export function forbiddenContentResponse(decision: ContentAccessDecision) {
  return NextResponse.json(
    {
      error: decision.message || "Forbidden",
      reason: decision.reason,
      upgradeHref: decision.upgradeHref,
    },
    { status: 403 }
  );
}

export async function getViewerAccess(): Promise<{
  user: AuthedUser | null;
  isPremium: boolean;
}> {
  const user = await getCurrentUser();
  if (!user) return { user: null, isPremium: false };
  const sub = await subscriptionService.getForUser(user.id);
  return { user, isPremium: sub.isPremium };
}

/**
 * Server-side gate for consuming curriculum content (not roleplay/tutor).
 */
export async function gateCurriculumContent(
  contentLevel: string | null | undefined,
  options?: { enforceProgression?: boolean }
): Promise<
  | { ok: true; user: AuthedUser; decision: ContentAccessDecision }
  | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!contentLevel) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  const sub = await subscriptionService.getForUser(user.id);
  const decision = authorizeContentAccess({
    isPremium: sub.isPremium,
    userLevel: user.learningProfile?.currentLevel,
    contentLevel,
    enforceProgression: options?.enforceProgression,
  });

  if (!decision.allowed) {
    return { ok: false, response: forbiddenContentResponse(decision) };
  }

  return { ok: true, user, decision };
}

const BODY_KEYS_BY_KIND = {
  passage: ["sentences"] as const,
  listening: ["items", "audioText"] as const,
  grammar: ["examples", "explanation", "explanationIt", "exercises", "realUse"] as const,
  speaking: ["items"] as const,
  writing: ["items"] as const,
};

export function attachCatalogAccess<T extends { level: string }>(
  item: T,
  isPremium: boolean,
  kind: keyof typeof BODY_KEYS_BY_KIND
): T & { locked: boolean; premiumRequired: boolean } {
  const meta = catalogLockMeta(isPremium, item.level);
  if (!meta.locked) {
    return { ...item, ...meta };
  }
  const redacted = { ...item, ...meta };
  for (const key of BODY_KEYS_BY_KIND[kind]) {
    if (key in redacted) {
      delete (redacted as Record<string, unknown>)[key];
    }
  }
  return redacted;
}

/**
 * True when href would open paywalled curriculum (not review/practice/roleplay/tutor).
 */
export function curriculumHrefRequiresPremium(
  href: string,
  isPremium: boolean
): boolean {
  if (isPremium) return false;
  const path = href.split("?")[0];

  const learn = path.match(/^\/learn\/([^/]+)/i);
  if (learn) return isPremiumRequiredForLevel(learn[1]);

  const read = path.match(/^\/read\/([^/]+)$/i);
  if (read) {
    const passage = contentService.getPassage(read[1]);
    return passage ? isPremiumRequiredForLevel(passage.level) : false;
  }

  const listen = path.match(/^\/listen\/([^/]+)$/i);
  if (listen) {
    const item = contentService.getListening(listen[1]);
    return item ? isPremiumRequiredForLevel(item.level) : false;
  }

  const grammar = path.match(/^\/grammar\/([^/]+)$/i);
  if (grammar) {
    const item = contentService.getGrammar(grammar[1]);
    return item ? isPremiumRequiredForLevel(item.level) : false;
  }

  const writing = path.match(/^\/speak\/write\/([^/]+)$/i);
  if (writing) {
    const item = contentService.getWriting(writing[1]);
    return item ? isPremiumRequiredForLevel(item.level) : false;
  }

  const speaking = path.match(/^\/speak\/([^/]+)$/i);
  if (speaking) {
    const item = contentService.getSpeaking(speaking[1]);
    return item ? isPremiumRequiredForLevel(item.level) : false;
  }

  return false;
}
