import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { aiService } from "@/services/ai/AIService";
import { getAIConfig } from "@/services/ai/config";

const schema = z.object({
  word: z.string().min(1),
  sentence: z.string().min(1),
  lemma: z.string().optional(),
  pos: z.string().optional(),
  annotatedTranslation: z.string().optional(),
  otherMeanings: z
    .array(z.object({ translation: z.string(), partOfSpeech: z.string() }))
    .optional(),
  level: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await request.json());

  if (body.annotatedTranslation) {
    const result = await aiService.getContextualMeaning(body, {
      userId: user.id,
    });
    return NextResponse.json(result);
  }

  // Alinea-first: without AI operational, use stub/annotation path only.
  if (!getAIConfig().operational) {
    const result = await aiService.getContextualMeaning(body, {
      userId: user.id,
    });
    return NextResponse.json(result);
  }

  const result = await aiService.getContextualMeaning(body, { userId: user.id });
  return NextResponse.json(result);
}
