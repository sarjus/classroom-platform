import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateCuid } from "@/lib/cuid";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const code = (body.code as string)?.toUpperCase().trim();

    if (!code || code.length < 4 || code.length > 10) {
      return NextResponse.json({ error: "Invalid join code" }, { status: 400 });
    }

    // Find classroom by code
    const { data: classroom, error: cErr } = await supabaseAdmin
      .from("Classroom")
      .select("id, name, isArchived")
      .eq("code", code)
      .maybeSingle();

    if (cErr || !classroom) {
      return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
    }
    if (classroom.isArchived) {
      return NextResponse.json({ error: "This classroom is archived" }, { status: 400 });
    }

    // Check existing enrollment
    const { data: existing } = await supabaseAdmin
      .from("Enrollment")
      .select("id, isActive")
      .eq("classroomId", classroom.id)
      .eq("userId", session.user.id)
      .maybeSingle();

    if (existing) {
      if (existing.isActive) {
        // Already enrolled — just redirect them
        return NextResponse.json({ classroomId: classroom.id, name: classroom.name });
      }
      // Re-activate inactive enrollment
      await supabaseAdmin
        .from("Enrollment")
        .update({ isActive: true })
        .eq("id", existing.id);
    } else {
      // Create new enrollment
      const now = new Date().toISOString();
      const { error: insertErr } = await supabaseAdmin
        .from("Enrollment")
        .insert({
          id: generateCuid(),
          classroomId: classroom.id,
          userId: session.user.id,
          isActive: true,
          joinedAt: now,
        });

      if (insertErr) {
        console.error("[join POST] insert error:", insertErr);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ classroomId: classroom.id, name: classroom.name });
  } catch (err) {
    console.error("[join POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
