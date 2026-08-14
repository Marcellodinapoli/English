"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Bot,
  Globe,
  Headphones,
  Home,
  Library,
  LineChart,
  Mic,
  PenLine,
  RefreshCw,
  Shapes,
  Sparkles,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainLinks = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/learn", label: "Learn", icon: Sparkles },
  { href: "/read", label: "Read", icon: BookOpen },
  { href: "/listen", label: "Listen", icon: Headphones },
  { href: "/speak", label: "Speak", icon: Mic },
  { href: "/tutor", label: "Tutor", icon: Bot },
  { href: "/real-life", label: "Real life", icon: Globe },
  { href: "/grammar", label: "Grammar", icon: Shapes },
  { href: "/vocabulary", label: "Vocabulary", icon: Library },
  { href: "/review", label: "Review", icon: RefreshCw },
  { href: "/practice", label: "Practice", icon: PenLine },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/profile", label: "Profile", icon: User },
];

const mobileLinks = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/learn", label: "Learn", icon: Sparkles },
  { href: "/real-life", label: "Real life", icon: Globe },
  { href: "/tutor", label: "Tutor", icon: Bot },
  { href: "/review", label: "Review", icon: RefreshCw },
];

export function Sidebar({
  name,
  level,
  xp,
  streak,
}: {
  name?: string;
  level?: string;
  xp?: number;
  streak?: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-[var(--sidebar-width)] shrink-0 flex-col border-r border-line/80 bg-[linear-gradient(180deg,#132033_0%,#1a2b40_100%)] text-white lg:flex">
      <div className="px-6 pb-4 pt-8">
        <div className="brand-mark text-3xl tracking-tight">Alinea</div>
        <p className="mt-1 text-sm text-white/55">Your English path</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {mainLinks.map((link) => {
          const active = pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-white/12 text-white"
                  : "text-white/65 hover:bg-white/8 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="m-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-white/60">Signed in as</p>
        <p className="mt-1 font-semibold">{name || "Learner"}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-black/20 px-2 py-2">
            <div className="text-white/50">Level</div>
            <div className="mt-1 font-semibold">{level || "—"}</div>
          </div>
          <div className="rounded-xl bg-black/20 px-2 py-2">
            <div className="text-white/50">XP</div>
            <div className="mt-1 font-semibold">{xp ?? 0}</div>
          </div>
          <div className="rounded-xl bg-black/20 px-2 py-2">
            <div className="text-white/50">Streak</div>
            <div className="mt-1 font-semibold">{streak ?? 0}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
      <div
        className="mx-auto grid max-w-lg grid-cols-5 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
        style={{ minHeight: "var(--bottom-nav-height)" }}
      >
        {mobileLinks.map((link) => {
          const active = pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium",
                active ? "text-teal" : "text-muted"
              )}
            >
              <Icon className="h-5 w-5" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
