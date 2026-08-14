"use client";

import { ConversationSession } from "@/components/conversation/ConversationSession";
import { useSession } from "@/hooks/useSession";

export default function TutorPage() {
  const session = useSession();
  const aiOn = Boolean(session.data?.aiOperational);

  return (
    <div className="space-y-8 animate-rise">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal">
          Tutor
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-4xl text-ink">
          Your personal guide
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Ask questions, practice sentences, and get guided help — adapted to your
          level and weak skills. The tutor nudges you toward answers instead of
          giving them away.
          {!aiOn
            ? " Guidance uses Alinea’s offline rules for now; cloud AI stays available when enabled."
            : ""}
        </p>
      </div>

      <ConversationSession type="tutor" />
    </div>
  );
}
