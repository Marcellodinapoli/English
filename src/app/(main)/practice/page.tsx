"use client";

import { Suspense } from "react";
import PracticeClient from "./PracticeClient";

export default function PracticePage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading practice...</p>}>
      <PracticeClient />
    </Suspense>
  );
}
