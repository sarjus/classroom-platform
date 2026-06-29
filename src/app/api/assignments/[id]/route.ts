import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { data: assignment } = await supabaseAdmin
      .from("Assignment")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (session.user.role === "STUDENT" && assignment.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ assignment });
  } catch (err) {
    console.error("[assignment GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { data: assignment } = await supabaseAdmin
      .from("Assignment")
      .select("id, creatorId, classroomId, status, title")
      .eq("id", id)
      .maybeSingle();

    if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (assignment.creatorId !== session.user.id && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const wasPublished = assignment.status !== "PUBLISHED" && body.status === "PUBLISHED";

    const { data: updated, error } = await supabaseAdmin
      .from("Assignment")
      .update({
        title: body.title,
        description: body.description ?? null,
        instructions: body.instructions ?? null,
        status: body.status,
        dueDate: body.dueDate ? new Date(body.dueDate).toISOString() : null,
        allowLateSubmission: body.allowLateSubmission ?? false,
        latePenaltyPercent: body.latePenaltyPercent ?? 0,
        maxScore: body.maxScore ?? 100,
        starterRepoUrl: body.starterRepoUrl || null,
        language: body.language,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[assignment PATCH] update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify students when publishing
    if (wasPublished) {
      const [{ data: enrollments = [] }, { data: classroom }] = await Promise.all([
        supabaseAdmin.from("Enrollment").select("userId").eq("classroomId", assignment.classroomId).eq("isActive", true),
        supabaseAdmin.from("Classroom").select("name").eq("id", assignment.classroomId).maybeSingle(),
      ]);

      const now = new Date().toISOString();
      const notifications = (enrollments as any[]).map((e: any) => ({
        id: `notif_${Date.now()}_${e.userId}`,
        userId: e.userId,
        type: "ASSIGNMENT_PUBLISHED",
        title: "New Assignment Published",
        message: `${classroom?.name ?? "Your class"}: ${updated.title}`,
        link: `/assignments/${id}`,
        isRead: false,
        createdAt: now,
      }));

      if (notifications.length > 0) {
        await supabaseAdmin.from("Notification").insert(notifications);
      }
    }

    return NextResponse.json({ assignment: updated });
  } catch (err) {
    console.error("[assignment PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const { data: assignment } = await supabaseAdmin
      .from("Assignment")
      .select("id, creatorId")
      .eq("id", id)
      .maybeSingle();

    if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (assignment.creatorId !== session.user.id && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await supabaseAdmin.from("Assignment").delete().eq("id", id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[assignment DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
