import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  adminContentService,
  type ContentBucket,
} from "@/services/admin/AdminContentService";

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
  { params }: { params: Promise<{ bucket: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { bucket } = await params;
  if (!BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }

  return NextResponse.json({
    items: adminContentService.listItems(bucket as ContentBucket),
  });
}
