import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { autogradeConfigSchema } from "@/lib/validations";
import { z } from "zod";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowedRoles = ["FACULTY", "INSTITUTION_ADMIN", "SUPER_ADMIN"];
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = autogradeConfigSchema.parse(body);

    // Upsert config
    const existing = await prisma.autogradeConfig.findUnique({
      where: { assignmentId: data.assignmentId },
    });

    if (existing) {
      // Delete old test cases
      await prisma.testCase.deleteMany({ where: { autogradeConfigId: existing.id } });
      const config = await (prisma.autogradeConfig.update as any)({
        where: { assignmentId: data.assignmentId },
        data: {
          language: data.language,
          buildCommand: data.buildCommand,
          runCommand: data.runCommand,
          timeLimit: data.timeLimit,
          memoryLimit: data.memoryLimit,
          testCases: {
            create: data.testCases.map((tc) => ({
              name: tc.name,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              points: tc.points,
              isHidden: tc.isHidden,
              timeout: tc.timeout,
              compareMode: tc.compareMode,
            })),
          },
        },
        include: { testCases: true },
      });
      return NextResponse.json({ config });
    }

    const config = await (prisma.autogradeConfig.create as any)({
      data: {
        assignmentId: data.assignmentId,
        language: data.language,
        buildCommand: data.buildCommand,
        runCommand: data.runCommand,
        timeLimit: data.timeLimit,
        memoryLimit: data.memoryLimit,
        testCases: {
          create: data.testCases.map((tc) => ({
            name: tc.name,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            points: tc.points,
            isHidden: tc.isHidden,
            timeout: tc.timeout,
            compareMode: tc.compareMode,
          })),
        },
      },
      include: { testCases: true },
    });

    return NextResponse.json({ config }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues?.[0]?.message ?? err.message }, { status: 400 });
    }
    console.error("[autograding config POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
