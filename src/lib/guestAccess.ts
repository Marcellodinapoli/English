import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  hashPassword,
  setSessionCookie,
} from "@/lib/auth";

const GUEST_NAME = "Ospite";

export function isGuestEmail(email: string): boolean {
  return /^guest-[0-9a-f-]+@alinea\.local$/i.test(email);
}

/**
 * Creates an isolated guest user (unique email per call).
 * Does not set the session cookie — use signInAsGuest for login flow.
 */
export async function createGuestUser() {
  const passwordHash = await hashPassword("guest-dev-only");
  const email = `guest-${crypto.randomUUID()}@alinea.local`;

  return prisma.user.create({
    data: {
      email,
      name: GUEST_NAME,
      passwordHash,
      role: "USER",
      profile: {
        create: {
          onboardingDone: true,
          assessmentDone: true,
          perceivedLevel: "zero",
          goal: "Practice English",
          dailyMinutes: 15,
        },
      },
      learningProfile: {
        create: {
          currentLevel: "ZERO",
          subLevel: 0.1,
        },
      },
      progress: { create: { streak: 1 } },
      subscription: {
        create: { plan: "FREE", status: "ACTIVE", provider: "local" },
      },
    },
  });
}

/**
 * Guest access with per-session isolation (no shared guest@alinea.local row).
 */
export async function signInAsGuest() {
  const user = await createGuestUser();
  const token = await createSessionToken(user.id);
  await setSessionCookie(token);
  return user;
}
