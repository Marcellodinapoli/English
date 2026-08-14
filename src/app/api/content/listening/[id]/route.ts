import { NextResponse } from "next/server";
import { contentService } from "@/services/content/ContentService";
import { gateCurriculumContent } from "@/lib/contentGate";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const item = contentService.getListening(id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const gate = await gateCurriculumContent(item.level);
  if (!gate.ok) return gate.response;

  return NextResponse.json({ item });
}
