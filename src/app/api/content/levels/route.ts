import { NextResponse } from "next/server";
import { contentService } from "@/services/content/ContentService";

export async function GET() {
  return NextResponse.json({ levels: contentService.getLevels() });
}