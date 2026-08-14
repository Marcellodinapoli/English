import { NextResponse } from "next/server";
import { contentService } from "@/services/content/ContentService";
import { expressionService } from "@/services/content/ExpressionService";
import { gateCurriculumContent } from "@/lib/contentGate";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  const { contentId } = await params;
  const passage = contentService.getPassage(contentId);
  if (!passage) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const gate = await gateCurriculumContent(passage.level);
  if (!gate.ok) return gate.response;

  const tokenSets = passage.sentences.map((s) => s.tokens);
  const { spansBySentence } = expressionService.resolveForPassage(
    passage.vocabularyFocus,
    tokenSets
  );

  const comprehension = contentService.getComprehension(contentId);

  return NextResponse.json({
    passage,
    expressions: spansBySentence.map((spans) =>
      spans.map((s) => ({
        start: s.start,
        end: s.end,
        expression: s.expression,
      }))
    ),
    comprehension,
  });
}
