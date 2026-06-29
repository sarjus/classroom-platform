import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsCharts } from "@/components/analytics/charts";
import { Users, GitBranch, Trophy, TrendingUp, AlertCircle } from "lucide-react";
import { gradeColor, percentage } from "@/lib/utils";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const user = session.user;
  const isStudent = user.role === "STUDENT";

  if (isStudent) {
    // Student analytics
    const submissions = await prisma.submission.findMany({
      where: { studentId: user.id },
      include: {
        assignment: { select: { title: true, maxScore: true, dueDate: true } },
        grade: { select: { score: true, maxScore: true, percentage: true, isReleased: true } },
        autogrades: { orderBy: { triggeredAt: "desc" }, take: 1 },
        commits: { select: { pushedAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const submissionsData = submissions as Array<{
      status: string;
      assignment: { title: string; maxScore: number; dueDate: string | null };
      grade: { score: number; maxScore: number; percentage: number; isReleased: boolean } | null;
      autogrades: Array<{ status: string }>;
      commits: Array<{ pushedAt: string }>;
    }>;

    const releasedGrades = submissionsData.filter((s) => s.grade?.isReleased);
    const avgGrade = releasedGrades.length > 0
      ? releasedGrades.reduce((sum, s) => sum + (s.grade?.percentage ?? 0), 0) / releasedGrades.length
      : 0;

    const chartData = releasedGrades.map((s) => ({
      name: s.assignment.title.slice(0, 20),
      score: Math.round(s.grade?.percentage ?? 0),
    }));

    return (
      <AppLayout title="My Analytics">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">My Performance</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Total Assignments</p>
              <p className="text-3xl font-bold mt-1">{submissions.length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Submitted</p>
              <p className="text-3xl font-bold mt-1">{submissionsData.filter((s) => s.status !== "PENDING" && s.status !== "ACCEPTED").length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Average Grade</p>
              <p className={`text-3xl font-bold mt-1 ${gradeColor(avgGrade)}`}>
                {avgGrade > 0 ? `${Math.round(avgGrade)}%` : "—"}
              </p>
            </CardContent></Card>
            <Card><CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Total Commits</p>
              <p className="text-3xl font-bold mt-1">
                {submissionsData.reduce((sum, s) => sum + s.commits.length, 0)}
              </p>
            </CardContent></Card>
          </div>

          <AnalyticsCharts data={chartData} type="student" />
        </div>
      </AppLayout>
    );
  }

  // Faculty analytics
  const classrooms = await prisma.classroom.findMany({
    where: user.role === "SUPER_ADMIN" ? {} : { instructorId: user.id },
    include: {
      _count: { select: { enrollments: true, assignments: true } },
      assignments: {
        include: {
          _count: { select: { submissions: true } },
          submissions: {
            include: { grade: { select: { percentage: true } } },
          },
        },
      },
      enrollments: { where: { isActive: true }, select: { userId: true } },
    },
  });

  type ClassroomWithData = {
    name: string;
    enrollments: Array<{ userId: string }>;
    assignments: Array<{
      _count: { submissions: number };
      submissions: Array<{ grade: { percentage: number } | null }>;
    }>;
  };
  const classroomsData = classrooms as ClassroomWithData[];

  const totalStudents = classroomsData.reduce((sum, c) => sum + c.enrollments.length, 0);
  const totalAssignments = classroomsData.reduce((sum, c) => sum + c.assignments.length, 0);
  const totalSubmissions = classroomsData.reduce(
    (sum, c) => sum + c.assignments.reduce((s2, a) => s2 + a._count.submissions, 0), 0
  );

  const allGrades: number[] = classroomsData.flatMap((c) =>
    c.assignments.flatMap((a) =>
      a.submissions.filter((s) => s.grade).map((s) => s.grade!.percentage)
    )
  );
  const avgGrade = allGrades.length > 0 ? allGrades.reduce((a, b) => a + b, 0) / allGrades.length : 0;

  const submissionByClassroom = classroomsData.map((c) => ({
    name: c.name.slice(0, 20),
    submissions: c.assignments.reduce((sum, a) => sum + a._count.submissions, 0),
    students: c.enrollments.length,
  }));

  return (
    <AppLayout title="Analytics">
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Analytics Overview</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Students", value: totalStudents, icon: Users, color: "blue" },
            { label: "Assignments", value: totalAssignments, icon: GitBranch, color: "green" },
            { label: "Submissions", value: totalSubmissions, icon: TrendingUp, color: "purple" },
            { label: "Avg Grade", value: avgGrade > 0 ? `${Math.round(avgGrade)}%` : "—", icon: Trophy, color: "yellow" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-full bg-${stat.color}-100 dark:bg-${stat.color}-900/30 flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <AnalyticsCharts data={submissionByClassroom} type="faculty" />
      </div>
    </AppLayout>
  );
}
