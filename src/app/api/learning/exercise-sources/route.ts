import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { personalizedExerciseSources } from "@/services/learning/PersonalizedExerciseSourceService";

/**
 * Ranked exercise sources for personalized practice (Phase 2).
 * Generation lives on POST /api/learning/practice/session.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const passageId = url.searchParams.get("passageId") || undefined;

  const sources = await personalizedExerciseSources.collect(user.id, {
    passageId,
  });

  return NextResponse.json({ sources });
}
