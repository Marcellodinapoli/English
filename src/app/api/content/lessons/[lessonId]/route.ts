import { NextResponse } from "next/server";
import { contentService } from "@/services/content/ContentService";
import { gateCurriculumContent } from "@/lib/contentGate";

export async function GET(
  _request: Request,
  context: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await context.params;
  const lesson = contentService.getLesson(lessonId);
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const gate = await gateCurriculumContent(lesson.levelId, {
    enforceProgression: true,
  });
  if (!gate.ok) return gate.response;

  return NextResponse.json({ lesson });
}
