import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateCuid } from "@/lib/cuid";
import { createAssignmentSchema } from "@/lib/validations";
import { z } from "zod";

// GET /api/assignments
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const classroomId = searchParams.get("classroomId");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const from = (page - 1) * limit;

  try {
    let query = supabaseAdmin
      .from("Assignment")
      .select("id, title, status, dueDate, maxScore, language, classroomId, creatorId, createdAt", { count: "exact" })
      .order("dueDate", { ascending: true })
      .range(from, from + limit - 1);

    if (classroomId) query = query.eq("classroomId", classroomId);
    if (status) query = query.eq("status", status);
    if (session.user.role === "STUDENT") query = query.eq("status", "PUBLISHED");

    const { data: assignments, count, error } = await query;
    if (error) throw error;

    // Enrich with classroom + creator names
    const classroomIds = [...new Set((assignments ?? []).map((a: any) => a.classroomId))];
    const creatorIds = [...new Set((assignments ?? []).map((a: any) => a.creatorId))];
    const assignmentIds = (assignments ?? []).map((a: any) => a.id);

    const [{ data: classrooms = [] }, { data: creators = [] }, { data: rubrics = [] }, { data: subCounts = [] }] =
      await Promise.all([
        classroomIds.length ? supabaseAdmin.from("Classroom").select("id, name").in("id", classroomIds) : Promise.resolve({ data: [] }),
        creatorIds.length ? supabaseAdmin.from("User").select("id, name").in("id", creatorIds) : Promise.resolve({ data: [] }),
        assignmentIds.length ? supabaseAdmin.from("Rubric").select("id, totalPoints, assignmentId").in("assignmentId", assignmentIds) : Promise.resolve({ data: [] }),
        assignmentIds.length ? supabaseAdmin.from("Submission").select("assignmentId").in("assignmentId", assignmentIds) : Promise.resolve({ data: [] }),
      ]);

    const classroomMap = Object.fromEntries((classrooms as any[]).map((c: any) => [c.id, c]));
    const creatorMap = Object.fromEntries((creators as any[]).map((u: any) => [u.id, u]));
    const rubricMap = Object.fromEntries((rubrics as any[]).map((r: any) => [r.assignmentId, r]));
    const countMap: Record<string, number> = {};
    for (const s of subCounts as any[]) countMap[s.assignmentId] = (countMap[s.assignmentId] ?? 0) + 1;

    const enriched = (assignments ?? []).map((a: any) => ({
      ...a,
      classroom: classroomMap[a.classroomId] ?? null,
      creator: creatorMap[a.creatorId] ?? null,
      rubric: rubricMap[a.id] ?? null,
      _count: { submissions: countMap[a.id] ?? 0 },
    }));

    return NextResponse.json({ assignments: enriched, total: count ?? 0, page, limit });
  } catch (err) {
    console.error("[assignments GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/assignments
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowedRoles = ["FACULTY", "INSTITUTION_ADMIN", "SUPER_ADMIN"];
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = createAssignmentSchema.parse(body);

    // Verify classroom ownership
    const { data: classroom, error: classroomError } = await supabaseAdmin
      .from("Classroom")
      .select("id, instructorId")
      .eq("id", data.classroomId)
      .maybeSingle();

    if (classroomError || !classroom) {
      return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
    }
    if (classroom.instructorId !== session.user.id && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { data: assignment, error } = await supabaseAdmin
      .from("Assignment")
      .insert({
        id: generateCuid(),
        title: data.title,
        description: data.description ?? null,
        instructions: data.instructions ?? null,
        classroomId: data.classroomId,
        creatorId: session.user.id,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
        allowLateSubmission: data.allowLateSubmission ?? false,
        latePenaltyPercent: data.latePenaltyPercent ?? 0,
        maxScore: data.maxScore ?? 100,
        starterRepoUrl: data.starterRepoUrl || null,
        language: data.language ?? "PYTHON",
        isGroupAssignment: data.isGroupAssignment ?? false,
        maxGroupSize: data.maxGroupSize ?? null,
        status: "DRAFT",
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) {
      console.error("[assignments POST] insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    }
    console.error("[assignments POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
