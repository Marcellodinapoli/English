import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { personalizedExerciseService } from "@/services/learning/PersonalizedExerciseService";
import type { PersonalizedExercise } from "@/types/practice";

const schema = z.object({
  durationMs: z.number().optional(),
  provider: z.enum(["rule", "ai"]).optional(),
  attempts: z.array(
    z.object({
      exerciseId: z.string(),
      userAnswer: z.union([z.string(), z.array(z.string())]),
    })
  ),
  items: z.array(z.any()),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await request.json());
  const items = body.items as PersonalizedExercise[];
  if (!items.length) {
    return NextResponse.json({ error: "No exercises" }, { status: 400 });
  }

  const outcome = await personalizedExerciseService.completeSession(
    user.id,
    items,
    body.attempts,
    { durationMs: body.durationMs, provider: body.provider }
  );

  return NextResponse.json(outcome);
}
