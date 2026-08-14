import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { personalizedExerciseService } from "@/services/learning/PersonalizedExerciseService";

const schema = z.object({
  count: z.number().min(1).max(12).optional(),
  passageId: z.string().optional(),
  provider: z.enum(["rule", "ai"]).optional(),
  skill: z.string().optional(),
  focus: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await request.json().catch(() => ({})));
  const session = await personalizedExerciseService.generateSession(user.id, {
    ...body,
    provider: body.provider ?? "rule",
  });
  return NextResponse.json(session);
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const count = Number(url.searchParams.get("count") || 5);
  const passageId = url.searchParams.get("passageId") || undefined;
  const skill = url.searchParams.get("skill") || undefined;
  const focus = url.searchParams.get("focus") || undefined;
  const session = await personalizedExerciseService.generateSession(user.id, {
    count: Number.isFinite(count) ? count : 5,
    passageId,
    skill,
    focus,
    provider: "rule",
  });
  return NextResponse.json(session);
}
