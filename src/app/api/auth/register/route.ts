import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { generateCuid } from "@/lib/cuid";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    const { data: existing } = await supabaseAdmin
      .from("User")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(data.password, 12);
    const now = new Date().toISOString();

    const { data: user, error } = await supabaseAdmin
      .from("User")
      .insert({
        id: generateCuid(),
        name: data.name,
        email: data.email,
        password: hashed,
        role: "STUDENT",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .select("id, email, name, role")
      .single();

    if (error) {
      console.error("[register]", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    }
    console.error("[register]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
