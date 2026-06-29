import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { supabaseAdmin } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, Plus, Clock, Code, Users } from "lucide-react";
import Link from "next/link";
import { formatDate, gradeColor, LANGUAGE_LABELS } from "@/lib/utils";

export default async function AssignmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const user = session.user;
  const isStudent = user.role === "STUDENT";

  let assignments: any[] = [];

  if (isStudent) {
    // Get enrolled classroom IDs
    const { data: enrollments = [] } = await supabaseAdmin
      .from("Enrollment")
      .select("classroomId")
      .eq("userId", user.id)
      .eq("isActive", true);

    const classroomIds = (enrollments as any[]).map((e) => e.classroomId);
    if (classroomIds.length === 0) {
      assignments = [];
    } else {
      const { data: raw = [] } = await supabaseAdmin
        .from("Assignment")
        .select("id, title, status, dueDate, maxScore, language, classroomId")
        .eq("status", "PUBLISHED")
        .in("classroomId", classroomIds)
        .order("dueDate", { ascending: true });

      if (raw.length > 0) {
        const assignmentIds = (raw as any[]).map((a) => a.id);
        const classroomIdSet = [...new Set((raw as any[]).map((a: any) => a.classroomId))];

        const [{ data: classrooms = [] }, { data: subs = [] }, { data: grades = [] }, { data: autogrades = [] }] =
          await Promise.all([
            supabaseAdmin.from("Classroom").select("id, name").in("id", classroomIdSet),
            supabaseAdmin.from("Submission")
              .select("id, assignmentId, status")
              .eq("studentId", user.id)
              .in("assignmentId", assignmentIds),
            supabaseAdmin.from("Grade")
              .select("submissionId, score, maxScore, percentage, isReleased"),
            supabaseAdmin.from("Autograde")
              .select("submissionId, status, score")
              .order("triggeredAt", { ascending: false }),
          ]);

        const classroomMap = Object.fromEntries((classrooms as any[]).map((c: any) => [c.id, c]));
        const subMap = Object.fromEntries((subs as any[]).map((s: any) => [s.assignmentId, s]));
        const gradeMap = Object.fromEntries((grades as any[]).map((g: any) => [g.submissionId, g]));
        const autogradeMap = Object.fromEntries(
          (subs as any[]).map((s: any) => [
            s.assignmentId,
            (autogrades as any[]).find((ag: any) => ag.submissionId === s.id),
          ])
        );

        assignments = (raw as any[]).map((a: any) => {
          const sub = subMap[a.id];
          const grade = sub ? gradeMap[sub.id] : null;
          const autograde = sub ? autogradeMap[a.id] : null;
          return {
            ...a,
            classroom: classroomMap[a.classroomId] ?? { name: "Unknown" },
            submissions: sub ? [{ ...sub, grade, autogrades: autograde ? [autograde] : [] }] : [],
          };
        });
      }
    }
  } else {
    // Faculty / Admin
    let query = supabaseAdmin
      .from("Assignment")
      .select("id, title, status, dueDate, maxScore, language, classroomId, createdAt")
      .order("createdAt", { ascending: false });

    if (user.role === "FACULTY") query = query.eq("creatorId", user.id);

    const { data: raw = [] } = await query;

    if (raw.length > 0) {
      const classroomIdSet = [...new Set((raw as any[]).map((a: any) => a.classroomId))];
      const assignmentIds = (raw as any[]).map((a: any) => a.id);

      const [{ data: classrooms = [] }, { data: subRows = [] }] = await Promise.all([
        supabaseAdmin.from("Classroom").select("id, name").in("id", classroomIdSet),
        supabaseAdmin.from("Submission").select("assignmentId").in("assignmentId", assignmentIds),
      ]);

      const classroomMap = Object.fromEntries((classrooms as any[]).map((c: any) => [c.id, c]));
      const countMap: Record<string, number> = {};
      for (const s of subRows as any[]) countMap[s.assignmentId] = (countMap[s.assignmentId] ?? 0) + 1;

      assignments = (raw as any[]).map((a: any) => ({
        ...a,
        classroom: classroomMap[a.classroomId] ?? { name: "Unknown" },
        _count: { submissions: countMap[a.id] ?? 0 },
      }));
    }
  }

  const statusColor: Record<string, string> = {
    DRAFT: "secondary", PUBLISHED: "success", ARCHIVED: "outline", SCHEDULED: "info",
  };

  return (
    <AppLayout title="Assignments">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Assignments</h2>
            <p className="text-muted-foreground">{assignments.length} assignment{assignments.length !== 1 ? "s" : ""}</p>
          </div>
          {!isStudent && (
            <Link href="/assignments/new">
              <Button><Plus className="w-4 h-4 mr-2" />New Assignment</Button>
            </Link>
          )}
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-20">
            <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No assignments yet</h3>
            <p className="text-muted-foreground">
              {isStudent ? "No assignments published yet" : "Create your first assignment to get started"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment: any) => {
              const submission = assignment.submissions?.[0];
              const grade = submission?.grade;
              const autograde = submission?.autogrades?.[0];
              return (
                <Link key={assignment.id} href={`/assignments/${assignment.id}`}>
                  <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Code className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-semibold">{assignment.title}</h3>
                            <Badge variant={(statusColor[assignment.status] as any) ?? "outline"} className="text-xs">
                              {assignment.status}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {LANGUAGE_LABELS[assignment.language] ?? assignment.language}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{assignment.classroom.name}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {assignment.dueDate && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />Due {formatDate(assignment.dueDate)}
                              </span>
                            )}
                            {!isStudent && assignment._count && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />{assignment._count.submissions} submissions
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-medium">{assignment.maxScore} pts</p>
                          {isStudent && submission && (
                            <div className="mt-1 space-y-1">
                              <Badge variant={submission.status === "SUBMITTED" || submission.status === "GRADED" ? "success" : "secondary"} className="text-xs">
                                {submission.status}
                              </Badge>
                              {grade?.isReleased && (
                                <p className={`text-xs font-medium ${gradeColor(grade.percentage)}`}>
                                  {Math.round(grade.percentage)}%
                                </p>
                              )}
                              {!grade && autograde && (
                                <p className="text-xs text-muted-foreground">Auto: {autograde.status}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
