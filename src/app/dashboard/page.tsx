import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { supabaseAdmin } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen, GitBranch, Trophy, Clock, TrendingUp,
  CheckCircle, AlertCircle, Plus,
} from "lucide-react";
import Link from "next/link";
import { formatDate, formatRelative, gradeColor, gradeLabel } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const user = session.user;
  const isStudent = user.role === "STUDENT";
  const isFaculty = ["FACULTY", "INSTITUTION_ADMIN", "SUPER_ADMIN"].includes(user.role);

  // ── classrooms count ──────────────────────────────────────────────────────
  let classroomsCount = 0;
  if (isStudent) {
    const { count } = await supabaseAdmin
      .from("Enrollment")
      .select("*", { count: "exact", head: true })
      .eq("userId", user.id)
      .eq("isActive", true);
    classroomsCount = count ?? 0;
  } else {
    const { count } = await supabaseAdmin
      .from("Classroom")
      .select("*", { count: "exact", head: true })
      .eq("instructorId", user.id);
    classroomsCount = count ?? 0;
  }

  // ── recent notifications ──────────────────────────────────────────────────
  const { data: recentNotifications = [] } = await supabaseAdmin
    .from("Notification")
    .select("id, title, message, link, createdAt")
    .eq("userId", user.id)
    .eq("isRead", false)
    .order("createdAt", { ascending: false })
    .limit(5);

  // ── recent assignments ────────────────────────────────────────────────────
  let recentAssignments: any[] = [];

  if (isStudent) {
    // Get enrolled classroom IDs
    const { data: enrollments = [] } = await supabaseAdmin
      .from("Enrollment")
      .select("classroomId")
      .eq("userId", user.id)
      .eq("isActive", true);

    const classroomIds = enrollments.map((e: any) => e.classroomId);

    if (classroomIds.length > 0) {
      const { data: assignments = [] } = await supabaseAdmin
        .from("Assignment")
        .select("id, title, status, dueDate, maxScore, language, classroomId")
        .eq("status", "PUBLISHED")
        .in("classroomId", classroomIds)
        .order("dueDate", { ascending: true })
        .limit(5);

      // Fetch classroom names and submissions for each assignment
      const assignmentIds = assignments.map((a: any) => a.id);
      const classroomIdSet = [...new Set(assignments.map((a: any) => a.classroomId))];

      const [{ data: classrooms = [] }, { data: submissions = [] }] = await Promise.all([
        supabaseAdmin.from("Classroom").select("id, name").in("id", classroomIdSet),
        supabaseAdmin.from("Submission")
          .select("id, assignmentId, status, gradeId:Grade(score, maxScore, percentage, isReleased)")
          .eq("studentId", user.id)
          .in("assignmentId", assignmentIds),
      ]);

      const classroomMap = Object.fromEntries((classrooms as any[]).map((c: any) => [c.id, c]));
      const submissionMap = Object.fromEntries((submissions as any[]).map((s: any) => [s.assignmentId, s]));

      recentAssignments = assignments.map((a: any) => ({
        ...a,
        classroom: classroomMap[a.classroomId] ?? { name: "Unknown" },
        submissions: submissionMap[a.id] ? [submissionMap[a.id]] : [],
      }));
    }
  } else {
    const { data: assignments = [] } = await supabaseAdmin
      .from("Assignment")
      .select("id, title, status, dueDate, maxScore, language, classroomId")
      .eq("creatorId", user.id)
      .order("createdAt", { ascending: false })
      .limit(5);

    if (assignments.length > 0) {
      const classroomIdSet = [...new Set(assignments.map((a: any) => a.classroomId))];
      const assignmentIds = assignments.map((a: any) => a.id);

      const [{ data: classrooms = [] }, { data: subCounts = [] }] = await Promise.all([
        supabaseAdmin.from("Classroom").select("id, name").in("id", classroomIdSet),
        supabaseAdmin.from("Submission")
          .select("assignmentId")
          .in("assignmentId", assignmentIds),
      ]);

      const classroomMap = Object.fromEntries((classrooms as any[]).map((c: any) => [c.id, c]));
      const countMap: Record<string, number> = {};
      for (const s of subCounts as any[]) {
        countMap[s.assignmentId] = (countMap[s.assignmentId] ?? 0) + 1;
      }

      recentAssignments = assignments.map((a: any) => ({
        ...a,
        classroom: classroomMap[a.classroomId] ?? { name: "Unknown" },
        _count: { submissions: countMap[a.id] ?? 0 },
      }));
    }
  }

  // ── student stats ─────────────────────────────────────────────────────────
  let studentStats = null;
  if (isStudent) {
    const [{ data: submissions = [] }, { data: grades = [] }] = await Promise.all([
      supabaseAdmin.from("Submission").select("id, status").eq("studentId", user.id),
      supabaseAdmin.from("Grade")
        .select("percentage, submissionId")
        .eq("isReleased", true)
        .in("submissionId",
          await supabaseAdmin.from("Submission").select("id").eq("studentId", user.id)
            .then(({ data }) => (data ?? []).map((s: any) => s.id))
        ),
    ]);

    const avg = grades.length > 0
      ? (grades as any[]).reduce((s: number, g: any) => s + g.percentage, 0) / grades.length
      : 0;

    studentStats = {
      total: submissions.length,
      submitted: (submissions as any[]).filter((s: any) => s.status !== "PENDING" && s.status !== "ACCEPTED").length,
      graded: grades.length,
      avg: Math.round(avg),
    };
  }

  // ── faculty stats ─────────────────────────────────────────────────────────
  let facultyStats = null;
  if (isFaculty) {
    // Get instructor's classroom IDs
    const { data: myClassrooms = [] } = await supabaseAdmin
      .from("Classroom")
      .select("id")
      .eq("instructorId", user.id);
    const myClassroomIds = (myClassrooms as any[]).map((c: any) => c.id);

    // Get instructor's assignment IDs
    const { data: myAssignments = [] } = await supabaseAdmin
      .from("Assignment")
      .select("id")
      .eq("creatorId", user.id);
    const myAssignmentIds = (myAssignments as any[]).map((a: any) => a.id);

    const [
      { count: totalStudents = 0 },
      { data: submittedSubs = [] },
      { count: totalSubmissions = 0 },
    ] = await Promise.all([
      supabaseAdmin.from("Enrollment")
        .select("*", { count: "exact", head: true })
        .in("classroomId", myClassroomIds.length ? myClassroomIds : ["__none__"])
        .eq("isActive", true),

      myAssignmentIds.length
        ? supabaseAdmin.from("Submission")
            .select("id")
            .in("assignmentId", myAssignmentIds)
            .eq("status", "SUBMITTED")
        : Promise.resolve({ data: [] }),

      myAssignmentIds.length
        ? supabaseAdmin.from("Submission")
            .select("*", { count: "exact", head: true })
            .in("assignmentId", myAssignmentIds)
        : Promise.resolve({ count: 0 }),
    ]);

    // Check which submitted subs have no grade
    let pendingGrades = 0;
    if (submittedSubs && submittedSubs.length > 0) {
      const subIds = (submittedSubs as any[]).map((s: any) => s.id);
      const { data: gradedSubs = [] } = await supabaseAdmin
        .from("Grade")
        .select("submissionId")
        .in("submissionId", subIds);
      const gradedIds = new Set((gradedSubs as any[]).map((g: any) => g.submissionId));
      pendingGrades = subIds.filter((id: string) => !gradedIds.has(id)).length;
    }

    facultyStats = {
      totalStudents: totalStudents ?? 0,
      pendingGrades,
      submissions: totalSubmissions ?? 0,
    };
  }

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Welcome */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Good morning, {user.name?.split(" ")[0]} 👋</h2>
            <p className="text-muted-foreground mt-1">Here&apos;s what&apos;s happening in your classrooms</p>
          </div>
          {isFaculty && (
            <div className="flex gap-2">
              <Link href="/classrooms/new">
                <Button variant="outline" size="sm"><Plus className="w-4 h-4 mr-2" />New Classroom</Button>
              </Link>
              <Link href="/assignments/new">
                <Button size="sm"><Plus className="w-4 h-4 mr-2" />New Assignment</Button>
              </Link>
            </div>
          )}
          {isStudent && (
            <Link href="/classrooms/join">
              <Button size="sm"><Plus className="w-4 h-4 mr-2" />Join Classroom</Button>
            </Link>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Classrooms</p>
                  <p className="text-3xl font-bold mt-1">{classroomsCount}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {isStudent && studentStats && (
            <>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Submissions</p>
                      <p className="text-3xl font-bold mt-1">{studentStats.submitted}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <GitBranch className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Average Grade</p>
                      <p className={`text-3xl font-bold mt-1 ${gradeColor(studentStats.avg)}`}>
                        {studentStats.avg > 0 ? `${studentStats.avg}%` : "—"}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-yellow-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Graded</p>
                      <p className="text-3xl font-bold mt-1">{studentStats.graded}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {isFaculty && facultyStats && (
            <>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Students</p>
                      <p className="text-3xl font-bold mt-1">{facultyStats.totalStudents}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Pending Grades</p>
                      <p className="text-3xl font-bold mt-1 text-orange-600">{facultyStats.pendingGrades}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Submissions</p>
                      <p className="text-3xl font-bold mt-1">{facultyStats.submissions}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <GitBranch className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Assignments */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {isStudent ? "Upcoming Assignments" : "Recent Assignments"}
                </CardTitle>
                <Link href="/assignments">
                  <Button variant="ghost" size="sm">View all</Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentAssignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No assignments yet</p>
                ) : (
                  recentAssignments.map((assignment: any) => {
                    const submission = assignment.submissions?.[0];
                    const grade = submission?.grade;
                    return (
                      <Link key={assignment.id} href={`/assignments/${assignment.id}`}>
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm truncate">{assignment.title}</p>
                              {assignment.status && (
                                <Badge variant={assignment.status === "PUBLISHED" ? "success" : "secondary"} className="text-xs">
                                  {assignment.status}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{assignment.classroom.name}</p>
                            {isStudent && grade && (
                              <div className="mt-1">
                                <span className={`text-xs font-medium ${gradeColor(grade.percentage)}`}>
                                  {Math.round(grade.percentage)}% — {gradeLabel(grade.percentage)}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            {assignment.dueDate && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {formatDate(assignment.dueDate)}
                              </div>
                            )}
                            {!isStudent && assignment._count && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {assignment._count.submissions} submissions
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* Notifications */}
          <div>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Notifications</CardTitle>
                <Link href="/notifications">
                  <Button variant="ghost" size="sm">View all</Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentNotifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">All caught up!</p>
                ) : (
                  recentNotifications.map((n: any) => (
                    <Link key={n.id} href={n.link ?? "/notifications"}>
                      <div className="flex gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{formatRelative(n.createdAt)}</p>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
