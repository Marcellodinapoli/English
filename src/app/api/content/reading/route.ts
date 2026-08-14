import { NextResponse } from "next/server";
import { contentService } from "@/services/content/ContentService";
import { attachCatalogAccess, getViewerAccess } from "@/lib/contentGate";

export async function GET() {
  const { isPremium } = await getViewerAccess();
  return NextResponse.json({
    passages: contentService
      .listPassages()
      .map((item) => attachCatalogAccess(item, isPremium, "passage")),
  });
}
