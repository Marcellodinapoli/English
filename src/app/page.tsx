import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user?.profile?.onboardingDone) redirect("/home");
  if (user && !user.profile?.onboardingDone) redirect("/onboarding/welcome");

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-teal/15 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-ink/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <div className="brand-mark text-3xl text-ink">Alinea</div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Accedi</Button>
            </Link>
            <Link href="/register">
              <Button>Start learning</Button>
            </Link>
          </div>
        </header>

        <section className="mt-16 grid flex-1 items-center gap-12 lg:mt-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="animate-rise">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal">
              Adaptive English System
            </p>
            <h1 className="mt-4 max-w-xl font-[family-name:var(--font-fraunces)] text-5xl leading-[1.05] text-ink md:text-6xl">
              From zero to fluent, with a teacher that knows you.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
              Alinea builds a personal learning path through listening, reading,
              vocabulary, grammar and real conversation — adapting every day to
              what you know and what you still need.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register">
                <Button size="xl">Create your path</Button>
              </Link>
              <Link href="/login">
                <Button size="xl" variant="outline">
                  Accedi
                </Button>
              </Link>
            </div>
          </div>

          <div className="glass-panel animate-rise rounded-[2rem] p-6 md:p-8">
            <p className="text-sm font-semibold text-teal">Today&apos;s plan</p>
            <h2 className="mt-2 font-[family-name:var(--font-fraunces)] text-3xl text-ink">
              Guided, never confusing
            </h2>
            <div className="mt-6 space-y-3">
              {[
                ["Listening", "5 min", "Strengthen comprehension"],
                ["Reading", "5 min", "Interactive words + context"],
                ["Vocabulary", "3 min", "Spaced personal lexicon"],
                ["Speaking", "5 min", "Produce real sentences"],
              ].map(([title, time, note]) => (
                <div
                  key={title}
                  className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-ink">{title}</p>
                    <p className="text-sm text-muted">{note}</p>
                  </div>
                  <span className="rounded-full bg-teal-soft px-3 py-1 text-xs font-semibold text-teal-deep">
                    {time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}