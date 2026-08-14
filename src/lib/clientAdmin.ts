const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminUser(user: { email: string; role?: string | null }) {
  if (user.role === "ADMIN") return true;
  return ADMIN_EMAILS.includes(user.email.toLowerCase());
}
