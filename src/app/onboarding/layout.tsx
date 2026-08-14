import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.onboardingDone) redirect("/home");

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <div className="brand-mark text-2xl text-ink">Alinea</div>
      <div className="mt-8">{children}</div>
    </div>
  );
}