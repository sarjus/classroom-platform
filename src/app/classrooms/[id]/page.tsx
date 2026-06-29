import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { supabaseAdmin } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BookOpen, Users, ClipboardList, Plus, Copy, Settings,
  Calendar, Clock,
} from "lucide-react";
import Link from "next/link";
import { formatDate, getInitials } from "@/lib/utils";

export default async function ClassroomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const { id } = await params;

  // ── fetch classroom ───────────────────────────────────────────────────────
  const { data: classroom } = await supabaseAdmin
    .from("Classroom")
    .select("id, name, description, code, instructorId, courseId, semester, year, isArchived, githubOrgUrl")
    .eq("id", id)
    .maybeSingle();

  if (!classroom) notFound();

  // ── fetch related data in parallel ───────────────────────────────────────
  const [
    { data: instructor },
    { data: course },
    { data: tas = [] },
    { data: enrollments = [] },
    { data: assignments = [] },
    { data: announcements = [] },
  ] = await Promise.all([
    supabaseAdmin.from("User").select("id, name, email, image").eq("id", classroom.instructorId).maybeSingle(),
    classroom.courseId
      ? supabaseAdmin.from("Course").select("id, name, code").eq("id", classroom.courseId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin.from("ClassroomTA").select("userId, assignedAt").eq("classroomId", id),
    supabaseAdmin.from("Enrollment").select("id, userId, joinedAt").eq("classroomId", id).eq("isActive", true).order("joinedAt", { ascending: true }),
    supabaseAdmin.from("Assignment").select("id, title, status, dueDate, maxScore, language").eq("classroomId", id).order("dueDate", { ascending: true }),
    supabaseAdmin.from("Announcement").select("id, title, content, isPinned, createdAt").eq("classroomId", id).order("createdAt", { ascending: false }).limit(5),
  ]);

  // ── enrich TAs with user info ─────────────────────────────────────────────
  const taUserIds = (tas as any[]).map((t: any) => t.userId);
  let taUsers: any[] = [];
  if (taUserIds.length > 0) {
    const { data } = await supabaseAdmin.from("User").select("id, name, image").in("id", taUserIds);
    taUsers = data ?? [];
  }
  const taUserMap = Object.fromEntries(taUsers.map((u: any) => [u.id, u]));
  const enrichedTas = (tas as any[]).map((t: any) => ({ ...t, user: taUserMap[t.userId] ?? { name: "Unknown" } }));

  // ── enrich enrollments with user info ─────────────────────────────────────
  const enrolledUserIds = (enrollments as any[]).map((e: any) => e.userId);
  let enrolledUsers: any[] = [];
  if (enrolledUserIds.length > 0) {
    const { data } = await supabaseAdmin.from("User").select("id, name, email, image").in("id", enrolledUserIds);
    enrolledUsers = data ?? [];
  }
  const enrolledUserMap = Object.fromEntries(enrolledUsers.map((u: any) => [u.id, u]));
  const enrichedEnrollments = (enrollments as any[]).map((e: any) => ({
    ...e,
    user: enrolledUserMap[e.userId] ?? { name: "Unknown", email: "" },
  }));

  // ── fetch submission counts per assignment ────────────────────────────────
  const assignmentIds = (assignments as any[]).map((a: any) => a.id);
  let subCountMap: Record<string, number> = {};
  if (assignmentIds.length > 0) {
    const { data: subRows = [] } = await supabaseAdmin
      .from("Submission")
      .select("assignmentId")
      .in("assignmentId", assignmentIds);
    for (const s of subRows as any[]) {
      subCountMap[s.assignmentId] = (subCountMap[s.assignmentId] ?? 0) + 1;
    }
  }

  const enrichedAssignments = (assignments as any[]).map((a: any) => ({
    ...a,
    _count: { submissions: subCountMap[a.id] ?? 0 },
  }));

  // ── permissions ───────────────────────────────────────────────────────────
  const isInstructor = classroom.instructorId === session.user.id;
  const isTA = enrichedTas.some((ta: any) => ta.userId === session.user.id);
  const canManage = isInstructor || isTA || ["INSTITUTION_ADMIN", "SUPER_ADMIN"].includes(session.user.role);

  return (
    <AppLayout title={classroom.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold">{classroom.name}</h2>
              {classroom.isArchived && <Badge variant="secondary">Archived</Badge>}
            </div>
            <p className="text-muted-foreground">{classroom.description}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              {classroom.semester && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />{classroom.semester} {classroom.year}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />{enrichedEnrollments.length} students
              </span>
              <span className="flex items-center gap-1">
                <ClipboardList className="w-4 h-4" />{enrichedAssignments.length} assignments
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {canManage && (
              <>
                <Link href={`/assignments/new?classroomId=${classroom.id}`}>
                  <Button size="sm"><Plus className="w-4 h-4 mr-2" />Assignment</Button>
                </Link>
                <Link href={`/classrooms/${id}/settings`}>
                  <Button size="sm" variant="outline"><Settings className="w-4 h-4" /></Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Join code */}
        {canManage && (
          <Card className="border-dashed">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Classroom Join Code</p>
                <p className="text-xs text-muted-foreground">Share this code with students to join</p>
              </div>
              <div className="flex items-center gap-3">
                <code className="text-2xl font-mono font-bold tracking-widest bg-muted px-4 py-2 rounded-lg">
                  {classroom.code}
                </code>
                <Button variant="outline" size="sm"><Copy className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="assignments">
          <TabsList>
            <TabsTrigger value="assignments">Assignments ({enrichedAssignments.length})</TabsTrigger>
            <TabsTrigger value="students">Students ({enrichedEnrollments.length})</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
          </TabsList>

          {/* Assignments */}
          <TabsContent value="assignments" className="space-y-3">
            {enrichedAssignments.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No assignments yet</p>
                {canManage && (
                  <Link href={`/assignments/new?classroomId=${classroom.id}`} className="mt-4 inline-block">
                    <Button size="sm"><Plus className="w-4 h-4 mr-2" />Create first assignment</Button>
                  </Link>
                )}
              </div>
            ) : (
              enrichedAssignments.map((a: any) => (
                <Link key={a.id} href={`/assignments/${a.id}`}>
                  <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{a.title}</p>
                        <Badge variant={a.status === "PUBLISHED" ? "success" : a.status === "DRAFT" ? "secondary" : "outline"} className="text-xs">
                          {a.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{a.language}</Badge>
                      </div>
                      {a.dueDate && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />Due {formatDate(a.dueDate)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{a.maxScore} pts</p>
                      {canManage && (
                        <p className="text-xs text-muted-foreground">{a._count.submissions} submissions</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </TabsContent>

          {/* Students */}
          <TabsContent value="students">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {enrichedEnrollments.map((e: any) => (
                <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={e.user.image ?? undefined} />
                    <AvatarFallback className="text-xs">{getInitials(e.user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.user.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Announcements */}
          <TabsContent value="announcements" className="space-y-3">
            {(announcements as any[]).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No announcements yet</p>
              </div>
            ) : (
              (announcements as any[]).map((a: any) => (
                <Card key={a.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      {a.isPinned && <Badge variant="info" className="text-xs">Pinned</Badge>}
                      {a.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{a.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">{formatDate(a.createdAt)}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
