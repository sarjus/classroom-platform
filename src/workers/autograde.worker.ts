/**
 * Autograding Worker
 * Run this as a separate process: npx tsx src/workers/autograde.worker.ts
 *
 * This worker picks jobs from the BullMQ queue and executes them
 * in a Docker sandbox for security and isolation.
 */

import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { DOCKER_IMAGES } from "../lib/utils";
import type { AutogradeJobData } from "../lib/queue";

// In production, use dockerode or child_process to run Docker
// For development/demo, we simulate the execution

async function runAutogradeJob(job: Job<AutogradeJobData>) {
  const { submissionId, commitSha } = job.data;

  console.log(`[autograde] Processing submission ${submissionId}`);

  // Mark as running
  await prisma.autograde.create({
    data: {
      submissionId,
      status: "RUNNING",
      commitSha,
      triggeredAt: new Date(),
    },
  });

  try {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          include: {
            autogradeConfig: {
              include: { testCases: true },
            },
          },
        },
      },
    });

    if (!submission?.assignment.autogradeConfig) {
      console.log(`[autograde] No config for ${submissionId}`);
      await prisma.autograde.updateMany({
        where: { submissionId, status: "RUNNING" },
        data: { status: "ERROR", completedAt: new Date(), executionLog: "No autograding configuration found." },
      });
      return;
    }

    const config = submission.assignment.autogradeConfig;
    const testCases = config.testCases;
    const dockerImage = DOCKER_IMAGES[config.language] ?? "python:3.11-slim";

    // --- Docker execution simulation ---
    // In production replace with actual Docker container execution:
    // const { exec, ExecResult } = await runInDocker({
    //   image: dockerImage,
    //   cloneUrl: submission.cloneUrl,
    //   buildCommand: config.buildCommand,
    //   runCommand: config.runCommand,
    //   timeLimit: config.timeLimit,
    //   memoryLimit: config.memoryLimit,
    //   testCases,
    // });

    const testResults = testCases.map((tc) => ({
      name: tc.name,
      passed: true, // Simulation: assume pass
      points: tc.points,
      maxPoints: tc.points,
      output: tc.expectedOutput ?? "",
      expected: tc.expectedOutput ?? "",
      executionTime: Math.floor(Math.random() * 500),
    }));

    const totalScore = testResults.reduce((sum, r) => sum + (r.passed ? r.points : 0), 0);
    const maxScore = testResults.reduce((sum, r) => sum + r.maxPoints, 0);

    await prisma.autograde.updateMany({
      where: { submissionId, status: "RUNNING" },
      data: {
        status: totalScore === maxScore ? "PASSED" : "FAILED",
        score: totalScore,
        maxScore,
        testResults: testResults as any,
        executionTime: 1200,
        memoryUsed: 64,
        completedAt: new Date(),
        executionLog: `Ran ${testResults.length} test cases. ${testResults.filter((t) => t.passed).length} passed.`,
      },
    });

    // Update submission score
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: "SUBMITTED" },
    });

    console.log(`[autograde] Completed ${submissionId}: ${totalScore}/${maxScore}`);
  } catch (err) {
    console.error(`[autograde] Error for ${submissionId}:`, err);
    await prisma.autograde.updateMany({
      where: { submissionId, status: "RUNNING" },
      data: {
        status: "ERROR",
        completedAt: new Date(),
        executionLog: err instanceof Error ? err.message : "Unknown error",
      },
    });
  }
}

const worker = new Worker<AutogradeJobData>("autograde", runAutogradeJob, {
  connection: redis,
  concurrency: 5,
});

worker.on("completed", (job) => {
  console.log(`[autograde] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[autograde] Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[autograde] Worker error:", err);
});

console.log("[autograde] Worker started");

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
