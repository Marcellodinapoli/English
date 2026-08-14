import { NextResponse } from "next/server";
import { signInAsGuest } from "@/lib/guestAccess";

export async function POST() {
  try {
    await signInAsGuest();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Access failed." }, { status: 500 });
  }
}
