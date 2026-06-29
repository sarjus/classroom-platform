import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitBranch, ExternalLink, CheckCircle, XCircle, AlertCircle, Clock, Code } from "lucide-react";
import Link from "next/link";
import { formatDateTime, formatDate, getInitials, gradeColor, LANGUAGE_LABELS } from "@/lib/utils";
import { GradeForm } from "@/components/grading/grade-form";

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const { id } = await params;
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, name: true, email: true, image: true } },
      assignment: {
        include: {
          rubric: { include: { criteria: { orderBy: { order: "asc" } } } },
          autogradeConfig: { include: { testCases: true } },
        },
      },
      commits: { orderBy: { pushedAt: "desc" } },
      autogrades: { orderBy: { triggeredAt: "desc" } },
      grade: {
        include: {
          items: { include: { criteria: true } },
          feedbacks: { include: { author: { select: { name: true, image: true } } } },
          grader: { select: { name: true } },
        },
      },
    },
  });

  if (!submission) notFound();

  const canGrade = ["FACULTY", "TEACHING_ASSISTANT", "INSTITUTION_ADMIN", "SUPER_ADMIN"].includes(session.user.role);
  const isOwner = submission.studentId === session.user.id;

  if (!canGrade && !isOwner) redirect("/dashboard");

  return (
    <AppLayout title={`Submission — ${submission.student.name}`}>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12">
              <AvatarImage src={submission.student.image ?? undefined} />
              <AvatarFallback>{getInitials(submission.student.name)}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold">{submission.student.name}</h2>
              <p className="text-sm text-muted-foreground">{submission.student.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant={submission.status === "GRADED" ? "success" : "secondary"}>{submission.status}</Badge>
            {submission.repoUrl && (
              <a href={submission.repoUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 mr-2" />View Repo
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* Assignment info */}
        <Card>
          <CardContent className="p-4 flex items-center gap-6 text-sm">
            <div><span className="text-muted-foreground">Assignment: </span><span className="font-medium">{submission.assignment.title}</span></div>
            <div><span className="text-muted-foreground">Language: </span><span className="font-medium">{LANGUAGE_LABELS[submission.assignment.language]}</span></div>
            {submission.assignment.dueDate && (
              <div><span className="text-muted-foreground">Due: </span><span className="font-medium">{formatDate(submission.assignment.dueDate)}</span></div>
            )}
            {submission.submittedAt && (
              <div><span className="text-muted-foreground">Submitted: </span><span className="font-medium">{formatDateTime(submission.submittedAt)}</span></div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="autograding">
          <TabsList>
            <TabsTrigger value="autograding">Autograding</TabsTrigger>
            <TabsTrigger value="commits">Commits ({submission.commits.length})</TabsTrigger>
            {canGrade && <TabsTrigger value="grade">Manual Grade</TabsTrigger>}
            {submission.grade && <TabsTrigger value="feedback">Feedback</TabsTrigger>}
          </TabsList>

          {/* Autograding */}
          <TabsContent value="autograding" className="space-y-4">
            {submission.autogrades.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-muted-foreground">No autograding runs yet.</CardContent></Card>
            ) : (
              submission.autogrades.map((ag: any) => (
                <Card key={ag.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {ag.status === "PASSED" && <CheckCircle className="w-5 h-5 text-green-500" />}
                        {ag.status === "FAILED" && <XCircle className="w-5 h-5 text-red-500" />}
                        {["ERROR", "TIMEOUT"].includes(ag.status) && <AlertCircle className="w-5 h-5 text-orange-500" />}
                        {ag.status === "RUNNING" && <Clock className="w-5 h-5 text-blue-500 animate-spin" />}
                        <CardTitle className="text-base">{ag.status}</CardTitle>
                        {ag.commitSha && <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{ag.commitSha.slice(0, 7)}</code>}
                      </div>
                      {ag.score !== null && (
                        <span className={`font-bold text-lg ${gradeColor((ag.score / (ag.maxScore ?? 1)) * 100)}`}>
                          {ag.score}/{ag.maxScore}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {ag.compilationLog && (
                      <div>
                        <p className="text-sm font-medium mb-1">Compilation</p>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">{ag.compilationLog}</pre>
                      </div>
                    )}
                    {ag.testResults && Array.isArray(ag.testResults) && (
                      <div>
                        <p className="text-sm font-medium mb-2">Test Results</p>
                        <div className="space-y-2">
                          {(ag.testResults as any[]).map((tr, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded border">
                              <div className="flex items-center gap-2">
                                {tr.passed ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                                <span className="text-sm">{tr.name}</span>
                              </div>
                              <span className="text-sm font-medium">{tr.passed ? tr.points : 0}/{tr.maxPoints}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-6 text-xs text-muted-foreground">
                      {ag.executionTime && <span>⏱ {ag.executionTime}ms</span>}
                      {ag.memoryUsed && <span>💾 {ag.memoryUsed}MB</span>}
                      <span>Ran {formatDate(ag.triggeredAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Commits */}
          <TabsContent value="commits">
            <Card>
              <CardContent className="p-0">
                {submission.commits.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">No commits recorded.</div>
                ) : (
                  <div className="divide-y">
                    {submission.commits.map((c: any) => (
                      <div key={c.id} className="flex items-start gap-3 p-4">
                        <Code className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{c.message ?? "(no message)"}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                            <code>{c.sha.slice(0, 7)}</code>
                            {c.authorName && <span>{c.authorName}</span>}
                            <span className="flex items-center gap-1 text-green-600">+{c.additions}</span>
                            <span className="flex items-center gap-1 text-red-600">-{c.deletions}</span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(c.pushedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manual Grade */}
          {canGrade && (
            <TabsContent value="grade">
              <GradeForm
                submissionId={id}
                rubric={submission.assignment.rubric}
                existingGrade={submission.grade}
                maxScore={submission.assignment.maxScore}
              />
            </TabsContent>
          )}

          {/* Feedback */}
          {submission.grade && (
            <TabsContent value="feedback">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Grade: {submission.grade.score}/{submission.grade.maxScore} ({Math.round(submission.grade.percentage)}%)
                    {submission.grade.grader && <span className="text-sm font-normal text-muted-foreground ml-2">by {submission.grade.grader.name}</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {submission.grade.notes && (
                    <div className="p-3 bg-muted/50 rounded">
                      <p className="text-sm text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm">{submission.grade.notes}</p>
                    </div>
                  )}
                  {submission.grade.feedbacks.map((f: any) => (
                    <div key={f.id} className="border-l-4 border-primary pl-4 py-1">
                      {f.filePath && <p className="text-xs font-mono text-muted-foreground mb-1">{f.filePath}{f.lineNumber ? `:${f.lineNumber}` : ""}</p>}
                      <p className="text-sm">{f.comment}</p>
                      <p className="text-xs text-muted-foreground mt-1">— {f.author.name}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
