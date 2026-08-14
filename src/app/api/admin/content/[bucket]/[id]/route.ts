import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  adminContentService,
  type ContentBucket,
} from "@/services/admin/AdminContentService";
import { invalidateContentCache } from "@/services/content/ContentService";

const BUCKETS = new Set([
  "passages",
  "listening",
  "grammar",
  "speaking",
  "writing",
  "roleplay",
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bucket: string; id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { bucket, id } = await params;
  if (!BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }

  const item = adminContentService.readItem(bucket as ContentBucket, id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ bucket: string; id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { bucket, id } = await params;
  if (!BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }

  try {
    const content = await request.json();
    const saved = adminContentService.writeItem(
      bucket as ContentBucket,
      id,
      content
    );
    invalidateContentCache();
    return NextResponse.json({ ok: true, ...saved });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save content";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
