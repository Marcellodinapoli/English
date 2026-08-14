import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BottomNav, Sidebar } from "@/components/layout/AppNav";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profile?.onboardingDone) redirect("/onboarding/welcome");

  return (
    <div className="flex min-h-screen">
      <Sidebar
        name={user.name}
        level={user.learningProfile?.currentLevel}
        xp={user.progress?.xp}
        streak={user.progress?.streak}
      />
      <div className="flex min-h-screen flex-1 flex-col">
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-8">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}