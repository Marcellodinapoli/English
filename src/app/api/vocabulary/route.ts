import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.userVocabulary.findMany({
    where: { userId: user.id },
    orderBy: { savedAt: "desc" },
  });

  return NextResponse.json({ items });
}