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

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const event = req.headers.get("x-github-event") ?? "";

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret && !verifySignature(body, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(body);
    const now = new Date().toISOString();

    if (event === "push") {
      const repoName = payload.repository?.name as string;
      const commitSha = payload.after as string;
      const commits: any[] = payload.commits ?? [];

      // Find matching submission by repo name
      const { data: submission } = await supabaseAdmin
        .from("Submission")
        .select("id, studentId")
        .eq("repoName", repoName)
        .maybeSingle();

      if (submission) {
        // Record commits
        for (const commit of commits) {
          await supabaseAdmin
            .from("Commit")
            .upsert({
              id: generateCuid(),
              submissionId: submission.id,
              sha: commit.id,
              message: commit.message ?? null,
              authorName: commit.author?.name ?? null,
              authorEmail: commit.author?.email ?? null,
              pushedAt: new Date(commit.timestamp).toISOString(),
              additions: commit.added?.length ?? 0,
              deletions: commit.removed?.length ?? 0,
              filesChanged: (commit.added?.length ?? 0) + (commit.modified?.length ?? 0) + (commit.removed?.length ?? 0),
              url: commit.url ?? null,
            }, { onConflict: "submissionId,sha", ignoreDuplicates: true });
        }

        // Update submission status to SUBMITTED
        await supabaseAdmin
          .from("Submission")
          .update({ status: "SUBMITTED", submittedAt: now, updatedAt: now })
          .eq("id", submission.id);

        // Create a QUEUED autograde record so UI shows it's pending
        await supabaseAdmin.from("Autograde").insert({
          id: generateCuid(),
          submissionId: submission.id,
          status: "QUEUED",
          commitSha,
          triggeredAt: now,
        });
      }
    }

    if (event === "repository" && payload.action === "deleted") {
      const repoName = payload.repository?.name as string;
      await supabaseAdmin
        .from("Submission")
        .update({ repoUrl: null, updatedAt: now })
        .eq("repoName", repoName);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook github]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
