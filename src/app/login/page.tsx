"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function enter() {
      const res = await fetch("/api/auth/guest", { method: "POST" });
      if (cancelled) return;
      if (!res.ok) {
        setError("Accesso non riuscito. Riprova.");
        return;
      }
      router.replace("/home");
      router.refresh();
    }

    void enter();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="brand-mark text-3xl text-ink">Alinea</div>
      <h1 className="mt-6 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
        Accesso
      </h1>
      <p className="mt-2 text-muted">
        {error || "Ingresso in corso, senza login..."}
      </p>
    </main>
  );
}
