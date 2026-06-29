/**
 * Repository Setup Worker
 * Handles GitHub repository creation for accepted assignments
 * Run separately: npx tsx src/workers/repo-setup.worker.ts
 */

import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { createOctokit, createRepositoryFromTemplate, addCollaborator } from "../lib/github";
import type { RepoSetupJobData } from "../lib/queue";

async function runRepoSetupJob(job: Job<RepoSetupJobData>) {
  const { submissionId, assignmentId, studentId, githubUsername, orgName, repoName, templateOwner, templateRepo } = job.data;

  console.log(`[repo-setup] Creating repo ${repoName} for ${githubUsername}`);

  try {
    const octokit = createOctokit();

    const repo = await createRepositoryFromTemplate(octokit, {
      org: orgName,
      name: repoName,
      private: true,
      templateOwner,
      templateRepo,
      autoInit: !templateOwner,
    });

    // Give student push access
    await addCollaborator(octokit, orgName, repoName, githubUsername, "push");

    // Give instructor read/admin access
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { classroom: { include: { instructor: true } } },
    });

    if (assignment?.classroom.instructor.username) {
      await addCollaborator(octokit, orgName, repoName, assignment.classroom.instructor.username, "admin");
    }

    // Update submission with repo details
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        repoUrl: repo.html_url,
        repoId: repo.id.toString(),
        cloneUrl: repo.clone_url,
        defaultBranch: repo.default_branch,
      },
    });

    console.log(`[repo-setup] Created ${repo.html_url}`);
  } catch (err) {
    console.error(`[repo-setup] Error for ${submissionId}:`, err);
    throw err; // Let BullMQ retry
  }
}

const worker = new Worker<RepoSetupJobData>("repo-setup", runRepoSetupJob, {
  connection: redis,
  concurrency: 3, // GitHub API has rate limits
});

worker.on("completed", (job) => {
  console.log(`[repo-setup] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[repo-setup] Job ${job?.id} failed:`, err.message);
});

console.log("[repo-setup] Worker started");

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
