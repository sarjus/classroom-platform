import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, username } = await req.json();

    // Check username uniqueness
    if (username) {
      const existing = await prisma.user.findFirst({
        where: { username, NOT: { id: session.user.id } },
      });
      if (existing) return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { name, username },
      select: { id: true, name: true, email: true, username: true, image: true, role: true },
    });

    return NextResponse.json({ user });
  } catch (err) {
    console.error("[users/me PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, username: true, image: true, role: true, createdAt: true },
  });

  return NextResponse.json({ user });
}
