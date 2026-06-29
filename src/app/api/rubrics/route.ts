import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { rubricSchema } from "@/lib/validations";
import { z } from "zod";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowedRoles = ["FACULTY", "TEACHING_ASSISTANT", "INSTITUTION_ADMIN", "SUPER_ADMIN"];
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = rubricSchema.parse(body);

    // Delete existing rubric if updating
    await prisma.rubric.deleteMany({ where: { assignmentId: data.assignmentId } });

    const rubric = await (prisma.rubric.create as any)({
      data: {
        assignmentId: data.assignmentId,
        totalPoints: data.totalPoints,
        criteria: {
          create: data.criteria.map((c, i) => ({
            title: c.title,
            description: c.description,
            maxPoints: c.maxPoints,
            order: c.order ?? i,
          })),
        },
      },
      include: { criteria: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json({ rubric });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    }
    console.error("[rubrics POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
