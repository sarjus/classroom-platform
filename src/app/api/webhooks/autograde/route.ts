import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { generateCuid } from "@/lib/cuid";

function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const expected = `sha256=${hmac.digest("hex")}`;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * POST /api/webhooks/autograde
 *
 * Called by the GitHub Actions autograding workflow in the student's repo.
 * Payload: { submissionId, commitSha, results: [{ name, passed, points, maxPoints }] }
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";

  const secret = process.env.GITHUB_WEBHOOK_SECRET ?? process.env.NEXTAUTH_SECRET ?? "secret";
  if (!verifySignature(body, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(body) as {
      submissionId: string;
      commitSha: string;
      results: Array<{ name: string; passed: boolean; points: number; maxPoints: number }>;
    };

    const { submissionId, commitSha, results } = payload;

    if (!submissionId || !results) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Verify submission exists
    const { data: submission } = await supabaseAdmin
      .from("Submission")
      .select("id, studentId, assignmentId")
      .eq("id", submissionId)
      .maybeSingle();

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const totalScore = results.reduce((sum, r) => sum + (r.passed ? r.points : 0), 0);
    const maxScore = results.reduce((sum, r) => sum + r.maxPoints, 0);
    const allPassed = results.every((r) => r.passed);
    const now = new Date().toISOString();

    // Upsert autograde record
    const autogradeId = generateCuid();
    await supabaseAdmin
      .from("Autograde")
      .insert({
        id: autogradeId,
        submissionId,
        status: allPassed ? "PASSED" : results.some((r) => r.passed) ? "FAILED" : "FAILED",
        score: totalScore,
        maxScore,
        commitSha: commitSha ?? null,
        testResults: results,
        executionLog: `GitHub Actions: ${results.filter((r) => r.passed).length}/${results.length} tests passed.`,
        triggeredAt: now,
        completedAt: now,
      });

    // Update submission status
    await supabaseAdmin
      .from("Submission")
      .update({ status: "SUBMITTED", submittedAt: now, updatedAt: now })
      .eq("id", submissionId);

    // Notify student
    const { data: assignment } = await supabaseAdmin
      .from("Assignment")
      .select("title")
      .eq("id", submission.assignmentId)
      .maybeSingle();

    await supabaseAdmin.from("Notification").insert({
      id: generateCuid(),
      userId: submission.studentId,
      type: "AUTOGRADING_COMPLETE",
      title: "Autograding Complete",
      message: `${assignment?.title ?? "Assignment"}: ${totalScore}/${maxScore} points (${results.filter((r) => r.passed).length}/${results.length} tests passed)`,
      link: `/submissions/${submissionId}`,
      isRead: false,
      createdAt: now,
    });

    console.log(`[autograde webhook] submission=${submissionId} score=${totalScore}/${maxScore}`);
    return NextResponse.json({ received: true, score: totalScore, maxScore });
  } catch (err) {
    console.error("[autograde webhook]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
