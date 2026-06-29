import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { supabaseAdmin } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock, GitBranch, CheckCircle, XCircle, AlertCircle, Users, Edit,
} from "lucide-react";
import Link from "next/link";
import { formatDate, formatDateTime, gradeColor, gradeLabel, LANGUAGE_LABELS } from "@/lib/utils";
import { AcceptAssignmentButton } from "@/components/assignments/accept-button";

export default async function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const { id } = await params;

  // ── fetch assignment ──────────────────────────────────────────────────────
  const { data: assignment } = await supabaseAdmin
    .from("Assignment")
    .select("id, title, description, instructions, status, dueDate, maxScore, language, classroomId, creatorId, allowLateSubmission, starterRepoUrl")
    .eq("id", id)
    .maybeSingle();

  if (!assignment) notFound();

  const isStudent = session.user.role === "STUDENT";
  const canManage = assignment.creatorId === session.user.id ||
    ["FACULTY", "INSTITUTION_ADMIN", "SUPER_ADMIN", "TEACHING_ASSISTANT"].includes(session.user.role);

  if (isStudent && assignment.status !== "PUBLISHED") notFound();

  // ── fetch classroom + creator ─────────────────────────────────────────────
  const [{ data: classroom }, { data: creator }] = await Promise.all([
    supabaseAdmin.from("Classroom").select("id, name, instructorId").eq("id", assignment.classroomId).maybeSingle(),
    supabaseAdmin.from("User").select("id, name").eq("id", assignment.creatorId).maybeSingle(),
  ]);

  // ── fetch rubric ──────────────────────────────────────────────────────────
  const { data: rubric } = await supabaseAdmin
    .from("Rubric")
    .select("id, totalPoints, assignmentId")
    .eq("assignmentId", id)
    .maybeSingle();

  let rubricCriteria: any[] = [];
  if (rubric) {
    const { data: criteria = [] } = await supabaseAdmin
      .from("RubricCriteria")
      .select("id, title, description, maxPoints, order")
      .eq("rubricId", rubric.id)
      .order("order", { ascending: true });
    rubricCriteria = criteria as any[];
  }

  // ── fetch autograde config ────────────────────────────────────────────────
  const { data: autogradeConfig } = await supabaseAdmin
    .from("AutogradeConfig")
    .select("id, language, buildCommand, runCommand, timeLimit, memoryLimit")
    .eq("assignmentId", id)
    .maybeSingle();

  let testCases: any[] = [];
  if (autogradeConfig) {
    const { data: tc = [] } = await supabaseAdmin
      .from("TestCase")
      .select("id, name, input, expectedOutput, points, isHidden, compareMode")
      .eq("autogradeConfigId", autogradeConfig.id)
      .eq("isHidden", false);
    testCases = tc as any[];
  }

  // ── submission count ──────────────────────────────────────────────────────
  const { count: submissionCount } = await supabaseAdmin
    .from("Submission")
    .select("*", { count: "exact", head: true })
    .eq("assignmentId", id);

  // ── student's own submission ──────────────────────────────────────────────
  let submission: any = null;
  if (isStudent) {
    const { data: sub } = await supabaseAdmin
      .from("Submission")
      .select("id, status, repoUrl, acceptedAt, submittedAt")
      .eq("assignmentId", id)
      .eq("studentId", session.user.id)
      .maybeSingle();

    if (sub) {
      const [{ data: commits = [] }, { data: autogrades = [] }, { data: grade }] = await Promise.all([
        supabaseAdmin.from("Commit").select("id, sha, message, authorName, pushedAt, additions, deletions").eq("submissionId", sub.id).order("pushedAt", { ascending: false }).limit(10),
        supabaseAdmin.from("Autograde").select("id, status, score, maxScore, compilationLog, triggeredAt").eq("submissionId", sub.id).order("triggeredAt", { ascending: false }).limit(3),
        supabaseAdmin.from("Grade").select("id, score, maxScore, percentage, isReleased, notes").eq("submissionId", sub.id).maybeSingle(),
      ]);

      let feedbacks: any[] = [];
      if (grade) {
        const { data: fb = [] } = await supabaseAdmin
          .from("Feedback")
          .select("id, filePath, lineNumber, comment, authorId")
          .eq("gradeId", (grade as any).id);
        const authorIds = [...new Set((fb as any[]).map((f: any) => f.authorId))];
        const { data: authors = [] } = authorIds.length
          ? await supabaseAdmin.from("User").select("id, name").in("id", authorIds)
          : Promise.resolve({ data: [] });
        const authorMap = Object.fromEntries((authors as any[]).map((u: any) => [u.id, u]));
        feedbacks = (fb as any[]).map((f: any) => ({ ...f, author: authorMap[f.authorId] ?? { name: "Unknown" } }));
      }

      let gradeItems: any[] = [];
      if (grade) {
        const { data: items = [] } = await supabaseAdmin
          .from("GradeItem")
          .select("id, criteriaId, points, comment")
          .eq("gradeId", (grade as any).id);
        gradeItems = items as any[];
      }

      submission = { ...sub, commits, autogrades, grade: grade ? { ...grade, feedbacks, items: gradeItems } : null };
    }
  }

  // ── all submissions for faculty ───────────────────────────────────────────
  let allSubmissions: any[] = [];
  if (canManage && !isStudent) {
    const { data: subs = [] } = await supabaseAdmin
      .from("Submission")
      .select("id, studentId, status, createdAt")
      .eq("assignmentId", id)
      .order("createdAt", { ascending: false });

    if (subs.length > 0) {
      const studentIds = [...new Set((subs as any[]).map((s: any) => s.studentId))];
      const subIds = (subs as any[]).map((s: any) => s.id);

      const [{ data: students = [] }, { data: grades = [] }, { data: autogrades = [] }, { data: commitCounts = [] }] =
        await Promise.all([
          supabaseAdmin.from("User").select("id, name, email, image").in("id", studentIds),
          supabaseAdmin.from("Grade").select("submissionId, score, maxScore, percentage, isReleased").in("submissionId", subIds),
          supabaseAdmin.from("Autograde").select("submissionId, status, score").in("submissionId", subIds).order("triggeredAt", { ascending: false }),
          supabaseAdmin.from("Commit").select("submissionId").in("submissionId", subIds),
        ]);

      const studentMap = Object.fromEntries((students as any[]).map((u: any) => [u.id, u]));
      const gradeMap = Object.fromEntries((grades as any[]).map((g: any) => [g.submissionId, g]));
      const autogradeMap: Record<string, any> = {};
      for (const ag of autogrades as any[]) {
        if (!autogradeMap[ag.submissionId]) autogradeMap[ag.submissionId] = ag;
      }
      const commitCountMap: Record<string, number> = {};
      for (const c of commitCounts as any[]) commitCountMap[c.submissionId] = (commitCountMap[c.submissionId] ?? 0) + 1;

      allSubmissions = (subs as any[]).map((s: any) => ({
        ...s,
        student: studentMap[s.studentId] ?? { name: "Unknown", email: "" },
        grade: gradeMap[s.id] ?? null,
        autogrades: autogradeMap[s.id] ? [autogradeMap[s.id]] : [],
        _count: { commits: commitCountMap[s.id] ?? 0 },
      }));
    }
  }

  const statusColors: Record<string, any> = {
    PUBLISHED: "success", DRAFT: "secondary", ARCHIVED: "outline", SCHEDULED: "info",
  };

  return (
    <AppLayout title={assignment.title}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h2 className="text-2xl font-bold">{assignment.title}</h2>
              <Badge variant={statusColors[assignment.status] ?? "outline"}>{assignment.status}</Badge>
              <Badge variant="outline">{LANGUAGE_LABELS[assignment.language]}</Badge>
            </div>
            <p className="text-muted-foreground mb-3">{assignment.description}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              {classroom && (
                <Link href={`/classrooms/${classroom.id}`} className="hover:text-foreground">
                  {classroom.name}
                </Link>
              )}
              {assignment.dueDate && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />Due {formatDateTime(assignment.dueDate)}
                </span>
              )}
              <span>{assignment.maxScore} points</span>
              {canManage && (
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />{submissionCount ?? 0} submissions
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {isStudent && !submission && assignment.status === "PUBLISHED" && (
              <AcceptAssignmentButton assignmentId={id} />
            )}
            {isStudent && submission?.repoUrl && (
              <a href={submission.repoUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm">
                  <GitBranch className="w-4 h-4 mr-2" />Open Repo
                </Button>
              </a>
            )}
            {canManage && (
              <Link href={`/assignments/${id}/edit`}>
                <Button variant="outline" size="sm"><Edit className="w-4 h-4 mr-2" />Edit</Button>
              </Link>
            )}
          </div>
        </div>

        <Tabs defaultValue={isStudent ? "overview" : "submissions"}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {isStudent && submission && <TabsTrigger value="my-submission">My Submission</TabsTrigger>}
            {canManage && <TabsTrigger value="submissions">Submissions ({submissionCount ?? 0})</TabsTrigger>}
            {rubric && <TabsTrigger value="rubric">Rubric</TabsTrigger>}
            {autogradeConfig && <TabsTrigger value="autograding">Autograding</TabsTrigger>}
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            <Card>
              <CardContent className="p-6 prose prose-sm dark:prose-invert max-w-none">
                {assignment.instructions ? (
                  <div className="whitespace-pre-wrap">{assignment.instructions}</div>
                ) : (
                  <p className="text-muted-foreground">No instructions provided.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Student Submission */}
          {isStudent && submission && (
            <TabsContent value="my-submission" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    <Badge variant={submission.status === "GRADED" ? "success" : "secondary"} className="text-sm">
                      {submission.status}
                    </Badge>
                  </CardContent>
                </Card>
                {submission.grade?.isReleased && (
                  <Card>
                    <CardContent className="p-5">
                      <p className="text-sm text-muted-foreground mb-1">Grade</p>
                      <p className={`text-2xl font-bold ${gradeColor(submission.grade.percentage)}`}>
                        {submission.grade.score}/{submission.grade.maxScore}
                        <span className="text-sm ml-1">({Math.round(submission.grade.percentage)}%)</span>
                      </p>
                    </CardContent>
                  </Card>
                )}
                <Card>
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground mb-1">Commits</p>
                    <p className="text-2xl font-bold">{submission.commits.length}</p>
                  </CardContent>
                </Card>
              </div>

              {submission.autogrades.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Autograding Results</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {submission.autogrades.map((ag: any) => (
                      <div key={ag.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {ag.status === "PASSED" && <CheckCircle className="w-4 h-4 text-green-500" />}
                            {ag.status === "FAILED" && <XCircle className="w-4 h-4 text-red-500" />}
                            {ag.status === "ERROR" && <AlertCircle className="w-4 h-4 text-orange-500" />}
                            <span className="font-medium text-sm">{ag.status}</span>
                          </div>
                          {ag.score !== null && ag.maxScore !== null && (
                            <span className="text-sm font-medium">{ag.score}/{ag.maxScore}</span>
                          )}
                        </div>
                        {ag.compilationLog && (
                          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">{ag.compilationLog}</pre>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {submission.grade?.isReleased && submission.grade.feedbacks.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Instructor Feedback</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {submission.grade.feedbacks.map((f: any) => (
                      <div key={f.id} className="border-l-4 border-primary pl-4 py-1">
                        {f.filePath && (
                          <p className="text-xs font-mono text-muted-foreground mb-1">
                            {f.filePath}{f.lineNumber ? `:${f.lineNumber}` : ""}
                          </p>
                        )}
                        <p className="text-sm">{f.comment}</p>
                        <p className="text-xs text-muted-foreground mt-1">— {f.author.name}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {submission.commits.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Recent Commits</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {submission.commits.map((c: any) => (
                        <div key={c.id} className="flex items-start gap-3 text-sm">
                          <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded flex-shrink-0">
                            {c.sha.slice(0, 7)}
                          </code>
                          <span className="flex-1 truncate">{c.message}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(c.pushedAt)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* Faculty Submissions */}
          {canManage && (
            <TabsContent value="submissions">
              <Card>
                <CardContent className="p-0">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left p-4">Student</th>
                        <th className="text-left p-4">Status</th>
                        <th className="text-left p-4">Commits</th>
                        <th className="text-left p-4">Autograde</th>
                        <th className="text-left p-4">Grade</th>
                        <th className="p-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {allSubmissions.map((s: any) => (
                        <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-4">
                            <p className="font-medium text-sm">{s.student.name}</p>
                            <p className="text-xs text-muted-foreground">{s.student.email}</p>
                          </td>
                          <td className="p-4">
                            <Badge variant={s.status === "SUBMITTED" || s.status === "GRADED" ? "success" : "secondary"} className="text-xs">
                              {s.status}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm">{s._count.commits}</td>
                          <td className="p-4">
                            {s.autogrades[0] ? (
                              <Badge variant={s.autogrades[0].status === "PASSED" ? "success" : "destructive"} className="text-xs">
                                {s.autogrades[0].status}
                                {s.autogrades[0].score !== null ? ` ${s.autogrades[0].score}` : ""}
                              </Badge>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="p-4">
                            {s.grade ? (
                              <span className={`text-sm font-medium ${gradeColor(s.grade.percentage)}`}>
                                {s.grade.score}/{s.grade.maxScore}
                              </span>
                            ) : <span className="text-xs text-muted-foreground">Ungraded</span>}
                          </td>
                          <td className="p-4">
                            <Link href={`/submissions/${s.id}`}>
                              <Button size="sm" variant="ghost">Review</Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Rubric */}
          {rubric && (
            <TabsContent value="rubric">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Grading Rubric — {rubric.totalPoints} points total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {rubricCriteria.map((c: any) => (
                      <div key={c.id} className="flex items-start justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{c.title}</p>
                          {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <span className="font-bold text-lg">{c.maxPoints}</span>
                          <span className="text-muted-foreground text-sm"> pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Autograding config */}
          {autogradeConfig && (
            <TabsContent value="autograding">
              <Card>
                <CardHeader><CardTitle className="text-base">Autograding Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><p className="text-muted-foreground">Language</p><p className="font-medium">{LANGUAGE_LABELS[autogradeConfig.language]}</p></div>
                    <div><p className="text-muted-foreground">Time Limit</p><p className="font-medium">{autogradeConfig.timeLimit}s</p></div>
                    <div><p className="text-muted-foreground">Memory Limit</p><p className="font-medium">{autogradeConfig.memoryLimit}MB</p></div>
                    <div><p className="text-muted-foreground">Test Cases</p><p className="font-medium">{testCases.length}</p></div>
                  </div>
                  {autogradeConfig.buildCommand && (
                    <div>
                      <p className="text-sm font-medium mb-1">Build Command</p>
                      <code className="text-xs bg-muted px-3 py-2 rounded block">{autogradeConfig.buildCommand}</code>
                    </div>
                  )}
                  {autogradeConfig.runCommand && (
                    <div>
                      <p className="text-sm font-medium mb-1">Run Command</p>
                      <code className="text-xs bg-muted px-3 py-2 rounded block">{autogradeConfig.runCommand}</code>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium mb-2">Visible Test Cases ({testCases.length})</p>
                    <div className="space-y-2">
                      {testCases.map((tc: any) => (
                        <div key={tc.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{tc.name}</span>
                            <span className="text-xs text-muted-foreground">{tc.points} pts</span>
                          </div>
                          {tc.input && <div className="text-xs"><span className="text-muted-foreground">Input: </span><code>{tc.input}</code></div>}
                          {tc.expectedOutput && <div className="text-xs"><span className="text-muted-foreground">Expected: </span><code>{tc.expectedOutput}</code></div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
