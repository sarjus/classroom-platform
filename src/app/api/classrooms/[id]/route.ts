import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/classrooms/:id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const classroom = await prisma.classroom.findUnique({
      where: { id },
      include: {
        instructor: { select: { id: true, name: true, email: true, image: true } },
        course: true,
        tas: { include: { user: { select: { id: true, name: true, image: true } } } },
        enrollments: {
          where: { isActive: true },
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
          take: 50,
        },
        assignments: {
          orderBy: { dueDate: "asc" },
          select: { id: true, title: true, status: true, dueDate: true, maxScore: true },
        },
        _count: { select: { enrollments: true, assignments: true } },
      },
    });

    if (!classroom) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ classroom });
  } catch (err) {
    console.error("[classroom GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/classrooms/:id
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const classroom = await prisma.classroom.findUnique({ where: { id } });
    if (!classroom) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (classroom.instructorId !== session.user.id && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const updated = await prisma.classroom.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        semester: body.semester,
        year: body.year,
        isArchived: body.isArchived,
      },
    });

    return NextResponse.json({ classroom: updated });
  } catch (err) {
    console.error("[classroom PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/classrooms/:id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const classroom = await prisma.classroom.findUnique({ where: { id } });
    if (!classroom) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (classroom.instructorId !== session.user.id && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.classroom.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[classroom DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
