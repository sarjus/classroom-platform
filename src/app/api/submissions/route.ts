import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateCuid } from "@/lib/cuid";
import { createOctokit, createRepositoryFromTemplate, addCollaborator, injectAutogradingWorkflow } from "@/lib/github";
import { generateAutogradingWorkflow } from "@/lib/autograding-workflow";

// GET /api/submissions
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const assignmentId = searchParams.get("assignmentId");
  const studentId = searchParams.get("studentId");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const from = (page - 1) * limit;

  try {
    let query = supabaseAdmin
      .from("Submission")
      .select("id, assignmentId, studentId, status, repoUrl, repoName, createdAt, updatedAt", { count: "exact" })
      .order("createdAt", { ascending: false })
      .range(from, from + limit - 1);

    if (assignmentId) query = query.eq("assignmentId", assignmentId);
    if (studentId) query = query.eq("studentId", studentId);
    if (session.user.role === "STUDENT") query = query.eq("studentId", session.user.id);

    const { data: submissions, count, error } = await query;
    if (error) throw error;

    if (!submissions?.length) {
      return NextResponse.json({ submissions: [], total: 0, page, limit });
    }

    const studentIds = [...new Set((submissions as any[]).map((s: any) => s.studentId))];
    const assignmentIds = [...new Set((submissions as any[]).map((s: any) => s.assignmentId))];
    const subIds = (submissions as any[]).map((s: any) => s.id);

    const [{ data: students = [] }, { data: assignments = [] }, { data: grades = [] }, { data: autogrades = [] }, { data: commitCounts = [] }] =
      await Promise.all([
        supabaseAdmin.from("User").select("id, name, email, image").in("id", studentIds),
        supabaseAdmin.from("Assignment").select("id, title, dueDate, maxScore").in("id", assignmentIds),
        supabaseAdmin.from("Grade").select("submissionId, score, maxScore, isReleased").in("submissionId", subIds),
        supabaseAdmin.from("Autograde").select("submissionId, status, score, maxScore").in("submissionId", subIds).order("triggeredAt", { ascending: false }),
        supabaseAdmin.from("Commit").select("submissionId").in("submissionId", subIds),
      ]);

    const studentMap = Object.fromEntries((students as any[]).map((u: any) => [u.id, u]));
    const assignmentMap = Object.fromEntries((assignments as any[]).map((a: any) => [a.id, a]));
    const gradeMap = Object.fromEntries((grades as any[]).map((g: any) => [g.submissionId, g]));
    const autogradeMap: Record<string, any> = {};
    for (const ag of autogrades as any[]) {
      if (!autogradeMap[ag.submissionId]) autogradeMap[ag.submissionId] = ag;
    }
    const commitCountMap: Record<string, number> = {};
    for (const c of commitCounts as any[]) commitCountMap[c.submissionId] = (commitCountMap[c.submissionId] ?? 0) + 1;

    const enriched = (submissions as any[]).map((s: any) => ({
      ...s,
      student: studentMap[s.studentId] ?? null,
      assignment: assignmentMap[s.assignmentId] ?? null,
      grade: gradeMap[s.id] ?? null,
      autogrades: autogradeMap[s.id] ? [autogradeMap[s.id]] : [],
      _count: { commits: commitCountMap[s.id] ?? 0 },
    }));

    return NextResponse.json({ submissions: enriched, total: count ?? 0, page, limit });
  } catch (err) {
    console.error("[submissions GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/submissions — student accepts an assignment
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { assignmentId } = await req.json();
    if (!assignmentId) return NextResponse.json({ error: "assignmentId required" }, { status: 400 });

    // Fetch assignment
    const { data: assignment } = await supabaseAdmin
      .from("Assignment")
      .select("id, status, classroomId, title, starterRepoUrl, language")
      .eq("id", assignmentId)
      .maybeSingle();

    if (!assignment || assignment.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Assignment not found or not published" }, { status: 404 });
    }

    // Check enrollment
    const { data: enrollment } = await supabaseAdmin
      .from("Enrollment")
      .select("id, isActive, studentId")
      .eq("classroomId", assignment.classroomId)
      .eq("userId", session.user.id)
      .maybeSingle();

    if (!enrollment?.isActive) {
      return NextResponse.json({ error: "Not enrolled in this classroom" }, { status: 403 });
    }

    // Idempotency — already accepted
    const { data: existing } = await supabaseAdmin
      .from("Submission")
      .select("id, status, repoUrl, repoName")
      .eq("assignmentId", assignmentId)
      .eq("studentId", session.user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        submission: existing,
        githubUrl: existing.repoUrl ?? "https://github.com/new",
      });
    }

    // Fetch classroom + student + autograde config
    const [{ data: classroom }, { data: student }, { data: autogradeConfig }] = await Promise.all([
      supabaseAdmin.from("Classroom").select("id, name, githubOrgUrl").eq("id", assignment.classroomId).maybeSingle(),
      supabaseAdmin.from("User").select("id, username, githubToken").eq("id", session.user.id).maybeSingle(),
      supabaseAdmin.from("AutogradeConfig").select("id, language, buildCommand, runCommand, timeLimit, memoryLimit").eq("assignmentId", assignmentId).maybeSingle(),
    ]);

    // Fetch test cases if config exists
    let testCases: any[] = [];
    if (autogradeConfig) {
      const { data: tc = [] } = await supabaseAdmin
        .from("TestCase")
        .select("name, input, expectedOutput, points, compareMode, timeout")
        .eq("autogradeConfigId", autogradeConfig.id);
      testCases = tc as any[];
    }

    // Build repo name
    const studentIdentifier = enrollment.studentId ?? session.user.id.slice(0, 8);
    const safeTitle = assignment.title.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").toLowerCase().slice(0, 30);
    const safeStudent = String(studentIdentifier).replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    const repoName = `${safeTitle}-${safeStudent}`.slice(0, 60);

    let repoUrl: string | null = null;
    let cloneUrl: string | null = null;

    const orgName = classroom?.githubOrgUrl?.split("/").pop();
    const githubToken = student?.githubToken ?? process.env.GITHUB_TOKEN;
    const githubUsername = student?.username;

    if (orgName && githubToken) {
      try {
        const octokit = createOctokit(githubToken);
        const templateParts = assignment.starterRepoUrl?.match(/github\.com\/([^/]+)\/([^/]+)/);

        // Step 1: Create repo from template or blank
        const repo = await createRepositoryFromTemplate(octokit, {
          org: orgName,
          name: repoName,
          private: true,
          templateOwner: templateParts?.[1],
          templateRepo: templateParts?.[2]?.replace(/\.git$/, ""),
          autoInit: !templateParts,
        });

        repoUrl = repo.html_url;
        cloneUrl = repo.clone_url;

        // Step 2: Add student as collaborator with push access
        if (githubUsername) {
          await addCollaborator(octokit, orgName, repoName, githubUsername, "push").catch((e) => {
            console.warn("[submissions] addCollaborator failed:", e.message);
          });
        }

        // Step 3: Inject autograding workflow (like GitHub Classroom)
        if (autogradeConfig && testCases.length > 0) {
          const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
          const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET ?? process.env.NEXTAUTH_SECRET ?? "secret";

          // Use a temp submission ID for the workflow (will be updated after insert)
          const tempId = generateCuid();
          const workflowYaml = generateAutogradingWorkflow(
            {
              language: autogradeConfig.language,
              buildCommand: autogradeConfig.buildCommand,
              runCommand: autogradeConfig.runCommand,
              timeLimit: autogradeConfig.timeLimit,
              memoryLimit: autogradeConfig.memoryLimit,
              testCases,
            },
            appUrl,
            tempId, // will be replaced after submission row is created
            webhookSecret
          );

          // Small delay to let repo initialise (template repos need a moment)
          await new Promise((r) => setTimeout(r, templateParts ? 3000 : 500));

          await injectAutogradingWorkflow(octokit, orgName, repoName, workflowYaml).catch((e) => {
            console.warn("[submissions] injectAutogradingWorkflow failed:", e.message);
          });
        }
      } catch (ghErr: any) {
        console.warn("[submissions POST] GitHub error:", ghErr.message);
      }
    }

    // Insert submission record
    const now = new Date().toISOString();
    const submissionId = generateCuid();

    const { data: submission, error: insertErr } = await supabaseAdmin
      .from("Submission")
      .insert({
        id: submissionId,
        assignmentId,
        studentId: session.user.id,
        status: "ACCEPTED",
        repoName,
        repoUrl,
        cloneUrl,
        acceptedAt: now,
        defaultBranch: "main",
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[submissions POST] insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Update workflow file with real submission ID if repo was created
    if (repoUrl && autogradeConfig && testCases.length > 0 && orgName && githubToken) {
      try {
        const octokit = createOctokit(githubToken);
        const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
        const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET ?? process.env.NEXTAUTH_SECRET ?? "secret";
        const workflowYaml = generateAutogradingWorkflow(
          {
            language: autogradeConfig.language,
            buildCommand: autogradeConfig.buildCommand,
            runCommand: autogradeConfig.runCommand,
            timeLimit: autogradeConfig.timeLimit,
            memoryLimit: autogradeConfig.memoryLimit,
            testCases,
          },
          appUrl,
          submissionId,
          webhookSecret
        );
        await injectAutogradingWorkflow(octokit, orgName, repoName, workflowYaml).catch(() => {});
      } catch {}
    }

    const githubUrl = repoUrl ?? (assignment.starterRepoUrl ? `${assignment.starterRepoUrl}/fork` : "https://github.com/new");

    return NextResponse.json({ submission, githubUrl }, { status: 201 });
  } catch (err) {
    console.error("[submissions POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
