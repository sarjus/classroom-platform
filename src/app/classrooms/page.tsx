import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { supabaseAdmin } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, ClipboardList, Plus, Copy, Archive } from "lucide-react";
import Link from "next/link";

export default async function ClassroomsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const user = session.user;
  const isStudent = user.role === "STUDENT";

  // Get classroom IDs based on role
  let classroomIds: string[] = [];
  if (isStudent) {
    const { data: enrollments = [] } = await supabaseAdmin
      .from("Enrollment")
      .select("classroomId")
      .eq("userId", user.id)
      .eq("isActive", true);
    classroomIds = (enrollments as any[]).map((e) => e.classroomId);
  }

  // Fetch classrooms
  let classroomsQuery = supabaseAdmin
    .from("Classroom")
    .select("id, name, description, code, instructorId, semester, year, isArchived, createdAt")
    .order("createdAt", { ascending: false });

  if (isStudent) {
    if (classroomIds.length === 0) {
      // No enrollments — return empty
      return (
        <AppLayout title="Classrooms">
          <EmptyState isStudent={isStudent} count={0} classrooms={[]} />
        </AppLayout>
      );
    }
    classroomsQuery = classroomsQuery.in("id", classroomIds);
  } else if (user.role !== "SUPER_ADMIN") {
    classroomsQuery = classroomsQuery.eq("instructorId", user.id);
  }

  const { data: classrooms = [] } = await classroomsQuery;

  if (!classrooms.length) {
    return (
      <AppLayout title="Classrooms">
        <EmptyState isStudent={isStudent} count={0} classrooms={[]} />
      </AppLayout>
    );
  }

  // Fetch instructor names
  const instructorIds = [...new Set((classrooms as any[]).map((c) => c.instructorId))];
  const { data: instructors = [] } = await supabaseAdmin
    .from("User")
    .select("id, name, image")
    .in("id", instructorIds);
  const instructorMap = Object.fromEntries((instructors as any[]).map((u) => [u.id, u]));

  // Fetch enrollment + assignment counts
  const ids = (classrooms as any[]).map((c) => c.id);
  const [{ data: enrollmentCounts = [] }, { data: assignmentCounts = [] }] = await Promise.all([
    supabaseAdmin.from("Enrollment").select("classroomId").in("classroomId", ids).eq("isActive", true),
    supabaseAdmin.from("Assignment").select("classroomId").in("classroomId", ids),
  ]);

  const enrollMap: Record<string, number> = {};
  for (const e of enrollmentCounts as any[]) enrollMap[e.classroomId] = (enrollMap[e.classroomId] ?? 0) + 1;
  const assignMap: Record<string, number> = {};
  for (const a of assignmentCounts as any[]) assignMap[a.classroomId] = (assignMap[a.classroomId] ?? 0) + 1;

  const enriched = (classrooms as any[]).map((c) => ({
    ...c,
    instructor: instructorMap[c.instructorId] ?? null,
    _count: { enrollments: enrollMap[c.id] ?? 0, assignments: assignMap[c.id] ?? 0 },
  }));

  return (
    <AppLayout title="Classrooms">
      <EmptyState isStudent={isStudent} count={enriched.length} classrooms={enriched} />
    </AppLayout>
  );
}

function EmptyState({ isStudent, count, classrooms }: { isStudent: boolean; count: number; classrooms: any[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Classrooms</h2>
          <p className="text-muted-foreground">{count} classroom{count !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          {isStudent ? (
            <Link href="/classrooms/join">
              <Button><Plus className="w-4 h-4 mr-2" />Join Classroom</Button>
            </Link>
          ) : (
            <Link href="/classrooms/new">
              <Button><Plus className="w-4 h-4 mr-2" />New Classroom</Button>
            </Link>
          )}
        </div>
      </div>

      {classrooms.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No classrooms yet</h3>
          <p className="text-muted-foreground mb-6">
            {isStudent ? "Join a classroom using a code from your instructor" : "Create your first classroom to get started"}
          </p>
          {isStudent ? (
            <Link href="/classrooms/join"><Button>Join Classroom</Button></Link>
          ) : (
            <Link href="/classrooms/new"><Button>Create Classroom</Button></Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {classrooms.map((classroom) => (
            <Link key={classroom.id} href={`/classrooms/${classroom.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    {classroom.isArchived && (
                      <Badge variant="secondary"><Archive className="w-3 h-3 mr-1" />Archived</Badge>
                    )}
                  </div>
                  <CardTitle className="text-base">{classroom.name}</CardTitle>
                  {classroom.description && (
                    <CardDescription className="line-clamp-2">{classroom.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />{classroom._count.enrollments} students
                    </span>
                    <span className="flex items-center gap-1">
                      <ClipboardList className="w-4 h-4" />{classroom._count.assignments} assignments
                    </span>
                  </div>
                  {classroom.semester && (
                    <p className="text-xs text-muted-foreground mt-2">{classroom.semester} {classroom.year}</p>
                  )}
                  {!isStudent && (
                    <div className="mt-3 flex items-center gap-2 p-2 rounded bg-muted/50">
                      <code className="text-xs font-mono flex-1">{classroom.code}</code>
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
