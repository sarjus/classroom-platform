import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classroomId = searchParams.get("classroomId");
  const assignmentId = searchParams.get("assignmentId");

  try {
    if (session.user.role === "STUDENT") {
      // Student analytics
      const [submissions, grades] = await Promise.all([
        prisma.submission.findMany({
          where: { studentId: session.user.id },
          include: {
            assignment: { select: { title: true, dueDate: true, maxScore: true } },
            grade: { select: { score: true, maxScore: true, percentage: true, isReleased: true } },
            autogrades: { orderBy: { triggeredAt: "desc" }, take: 1 },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.grade.findMany({
          where: { submission: { studentId: session.user.id }, isReleased: true },
          select: { score: true, maxScore: true, percentage: true },
        }),
      ]);

      const avgGrade = grades.length > 0
        ? grades.reduce((sum, g) => sum + g.percentage, 0) / grades.length
        : 0;

      return NextResponse.json({
        submissions,
        totalSubmissions: submissions.length,
        gradedCount: grades.length,
        averageGrade: Math.round(avgGrade),
      });
    }

    // Faculty/Admin analytics
    const where: Record<string, unknown> = {};
    if (classroomId) where.classroomId = classroomId;
    if (assignmentId) where.id = assignmentId;

    const assignments = await prisma.assignment.findMany({
      where: classroomId ? { classroomId } : { creatorId: session.user.id },
      include: {
        _count: { select: { submissions: true } },
        submissions: {
          include: {
            grade: { select: { score: true, maxScore: true, percentage: true } },
            autogrades: { orderBy: { triggeredAt: "desc" }, take: 1 },
          },
        },
      },
    });

    const classroomEnrollments = classroomId
      ? await prisma.enrollment.count({ where: { classroomId, isActive: true } })
      : 0;

    const stats = assignments.map((a) => {
      const submitted = a.submissions.filter((s) => s.status !== "PENDING").length;
      const graded = a.submissions.filter((s) => s.grade).length;
      const grades = a.submissions.filter((s) => s.grade).map((s) => s.grade!.percentage);
      const avgScore = grades.length > 0 ? grades.reduce((x, y) => x + y, 0) / grades.length : 0;

      return {
        id: a.id,
        title: a.title,
        dueDate: a.dueDate,
        totalStudents: classroomEnrollments,
        submitted,
        graded,
        submissionRate: classroomEnrollments > 0 ? (submitted / classroomEnrollments) * 100 : 0,
        averageScore: Math.round(avgScore),
      };
    });

    return NextResponse.json({ assignments: stats, classroomEnrollments });
  } catch (err) {
    console.error("[analytics GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
