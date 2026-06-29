import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateCuid } from "@/lib/cuid";
import { createClassroomSchema } from "@/lib/validations";
import { generateJoinCode } from "@/lib/utils";
import { z } from "zod";

// GET /api/classrooms
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const from = (page - 1) * limit;

  try {
    let classroomIds: string[] | null = null;

    // Scope by role
    if (session.user.role === "STUDENT") {
      const { data: enrollments = [] } = await supabaseAdmin
        .from("Enrollment")
        .select("classroomId")
        .eq("userId", session.user.id)
        .eq("isActive", true);
      classroomIds = (enrollments as any[]).map((e) => e.classroomId);
      if (classroomIds.length === 0) {
        return NextResponse.json({ classrooms: [], total: 0, page, limit });
      }
    } else if (session.user.role === "TEACHING_ASSISTANT") {
      const { data: taRows = [] } = await supabaseAdmin
        .from("ClassroomTA")
        .select("classroomId")
        .eq("userId", session.user.id);
      classroomIds = (taRows as any[]).map((t) => t.classroomId);
      if (classroomIds.length === 0) {
        return NextResponse.json({ classrooms: [], total: 0, page, limit });
      }
    }

    let query = supabaseAdmin
      .from("Classroom")
      .select("id, name, description, code, instructorId, semester, year, isArchived, createdAt", { count: "exact" })
      .order("createdAt", { ascending: false })
      .range(from, from + limit - 1);

    if (classroomIds !== null) {
      query = query.in("id", classroomIds);
    } else if (session.user.role === "FACULTY") {
      query = query.eq("instructorId", session.user.id);
    }
    // SUPER_ADMIN / INSTITUTION_ADMIN see all

    const { data: classrooms, count, error } = await query;
    if (error) throw error;

    if (!classrooms?.length) {
      return NextResponse.json({ classrooms: [], total: count ?? 0, page, limit });
    }

    // Enrich with instructor + counts
    const instructorIds = [...new Set((classrooms as any[]).map((c: any) => c.instructorId))];
    const ids = (classrooms as any[]).map((c: any) => c.id);

    const [{ data: instructors = [] }, { data: enrollCounts = [] }, { data: assignCounts = [] }] =
      await Promise.all([
        supabaseAdmin.from("User").select("id, name, image").in("id", instructorIds),
        supabaseAdmin.from("Enrollment").select("classroomId").in("classroomId", ids).eq("isActive", true),
        supabaseAdmin.from("Assignment").select("classroomId").in("classroomId", ids),
      ]);

    const instructorMap = Object.fromEntries((instructors as any[]).map((u: any) => [u.id, u]));
    const enrollMap: Record<string, number> = {};
    for (const e of enrollCounts as any[]) enrollMap[e.classroomId] = (enrollMap[e.classroomId] ?? 0) + 1;
    const assignMap: Record<string, number> = {};
    for (const a of assignCounts as any[]) assignMap[a.classroomId] = (assignMap[a.classroomId] ?? 0) + 1;

    const enriched = (classrooms as any[]).map((c: any) => ({
      ...c,
      instructor: instructorMap[c.instructorId] ?? null,
      _count: { enrollments: enrollMap[c.id] ?? 0, assignments: assignMap[c.id] ?? 0 },
    }));

    return NextResponse.json({ classrooms: enriched, total: count ?? 0, page, limit });
  } catch (err) {
    console.error("[classrooms GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/classrooms
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowedRoles = ["FACULTY", "INSTITUTION_ADMIN", "SUPER_ADMIN"];
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = createClassroomSchema.parse(body);

    // Generate unique join code
    let code = "";
    for (let i = 0; i < 10; i++) {
      const candidate = generateJoinCode();
      const { data: existing } = await supabaseAdmin
        .from("Classroom")
        .select("id")
        .eq("code", candidate)
        .maybeSingle();
      if (!existing) { code = candidate; break; }
    }
    if (!code) return NextResponse.json({ error: "Could not generate unique code" }, { status: 500 });

    const now = new Date().toISOString();
    const { data: classroom, error } = await supabaseAdmin
      .from("Classroom")
      .insert({
        id: generateCuid(),
        name: data.name,
        description: data.description ?? null,
        semester: data.semester ?? null,
        year: data.year ?? null,
        courseId: data.courseId ?? null,
        instructorId: session.user.id,
        code,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) {
      console.error("[classrooms POST] insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ classroom }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    }
    console.error("[classrooms POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
