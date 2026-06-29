import { Queue } from "bullmq";

// ─── Connection ───────────────────────────────────────────────────────────────

function getRedisConnection() {
  const url = process.env.REDIS_URL;

  // Don't attempt connection if Redis isn't configured for production
  if (!url || ((url.includes("localhost") || url.includes("127.0.0.1")) && process.env.NODE_ENV === "production")) {
    return null;
  }

  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379"),
      password: parsed.password || undefined,
      maxRetriesPerRequest: null as null,
      enableReadyCheck: false,
      lazyConnect: true,
    };
  } catch {
    return null;
  }
}

const connection = getRedisConnection();

// ─── Queue Definitions ────────────────────────────────────────────────────────
// Queues are null when Redis is unavailable — callers must check before using

function makeQueue(name: string, opts: object) {
  if (!connection) return null;
  try {
    return new Queue(name, {
      connection,
      defaultJobOptions: opts,
    });
  } catch (err) {
    console.warn(`[queue] failed to create queue "${name}":`, err);
    return null;
  }
}

export const autogradeQueue = makeQueue("autograde", {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 200,
});

export const notificationQueue = makeQueue("notifications", {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: 50,
  removeOnFail: 100,
});

export const repoSetupQueue = makeQueue("repo-setup", {
  attempts: 5,
  backoff: { type: "exponential", delay: 3000 },
  removeOnComplete: 50,
  removeOnFail: 100,
});

// ─── Job Types ────────────────────────────────────────────────────────────────

export interface AutogradeJobData {
  submissionId: string;
  commitSha?: string;
}

export interface NotificationJobData {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  email?: string;
}

export interface RepoSetupJobData {
  submissionId: string;
  assignmentId: string;
  studentId: string;
  githubUsername: string;
  orgName: string;
  repoName: string;
  templateOwner?: string;
  templateRepo?: string;
}

// ─── Queue Helpers ────────────────────────────────────────────────────────────

export async function enqueueAutograde(data: AutogradeJobData) {
  if (!autogradeQueue) {
    console.warn("[queue] autogradeQueue unavailable — Redis not configured");
    return null;
  }
  return autogradeQueue.add("run-autograde", data, { priority: 1 });
}

export async function enqueueNotification(data: NotificationJobData) {
  if (!notificationQueue) {
    console.warn("[queue] notificationQueue unavailable — Redis not configured");
    return null;
  }
  return notificationQueue.add("send-notification", data);
}

export async function enqueueRepoSetup(data: RepoSetupJobData) {
  if (!repoSetupQueue) {
    console.warn("[queue] repoSetupQueue unavailable — Redis not configured");
    return null;
  }
  return repoSetupQueue.add("setup-repo", data, { priority: 1 });
}
