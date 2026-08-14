import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSessionToken,
  hashPassword,
  setSessionCookie,
} from "@/lib/auth";
import { resolveRoleForEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const existing = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(body.password);
    const email = body.email.toLowerCase();
    const user = await prisma.user.create({
      data: {
        name: body.name.trim(),
        email,
        passwordHash,
        role: resolveRoleForEmail(email),
        profile: { create: {} },
        learningProfile: { create: {} },
        progress: { create: {} },
        subscription: {
          create: { plan: "FREE", status: "ACTIVE", provider: "local" },
        },
      },
    });

    const token = await createSessionToken(user.id);
    await setSessionCookie(token);

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid registration data." }, { status: 400 });
    }
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}