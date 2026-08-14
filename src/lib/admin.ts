import { getCurrentUser } from "@/lib/auth";

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: { email: string; role?: string | null }) {
  if (user.role === "ADMIN") return true;
  return getAdminEmails().includes(user.email.toLowerCase());
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdminUser(user)) {
    return null;
  }
  return user;
}

export function resolveRoleForEmail(email: string): "USER" | "ADMIN" {
  return getAdminEmails().includes(email.toLowerCase()) ? "ADMIN" : "USER";
}
