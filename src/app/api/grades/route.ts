import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { gradeSchema } from "@/lib/validations";
import { z } from "zod";
import { enqueueNotification } from "@/lib/queue";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowedRoles = ["FACULTY", "TEACHING_ASSISTANT", "INSTITUTION_ADMIN", "SUPER_ADMIN"];
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = gradeSchema.parse(body);

    const submission = await prisma.submission.findUnique({
      where: { id: data.submissionId },
      include: { assignment: true, student: true },
    });
    if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

    // Calculate total
    const totalPoints = data.items.reduce((sum, item) => sum + item.points, 0);

    // Upsert grade
    const grade = await prisma.grade.upsert({
      where: { submissionId: data.submissionId },
      create: {
        submissionId: data.submissionId,
        graderId: session.user.id,
        score: totalPoints,
        maxScore: submission.assignment.maxScore,
        percentage: (totalPoints / submission.assignment.maxScore) * 100,
        notes: data.notes,
        isReleased: data.isReleased,
        items: {
          create: data.items.map((item) => ({
            criteriaId: item.criteriaId,
            points: item.points,
            comment: item.comment,
          })),
        },
      },
      update: {
        graderId: session.user.id,
        score: totalPoints,
        maxScore: submission.assignment.maxScore,
        percentage: (totalPoints / submission.assignment.maxScore) * 100,
        notes: data.notes,
        isReleased: data.isReleased,
      },
    });

    // Update submission status
    await prisma.submission.update({
      where: { id: data.submissionId },
      data: { status: "GRADED" },
    });

    // Notify student if released
    if (data.isReleased) {
      await enqueueNotification({
        userId: submission.studentId,
        type: "GRADE_RELEASED",
        title: "Grade Available",
        message: `Your submission for "${submission.assignment.title}" has been graded.`,
        link: `/submissions/${submission.id}`,
        email: submission.student.email ?? undefined,
      });
    }

    return NextResponse.json({ grade });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    }
    console.error("[grades POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
