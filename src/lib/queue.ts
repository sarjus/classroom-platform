import { Queue } from "bullmq";

// BullMQ bundles its own ioredis; pass a connection URL object to avoid type conflicts
function getRedisConnection() {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379"),
      password: parsed.password || undefined,
      maxRetriesPerRequest: null as null,
      enableReadyCheck: false,
    };
  } catch {
    return {
      host: "localhost",
      port: 6379,
      maxRetriesPerRequest: null as null,
      enableReadyCheck: false,
    };
  }
}

const connection = getRedisConnection();

// ─── Queue Definitions ────────────────────────────────────────────────────────

export const autogradeQueue = new Queue("autograde", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const notificationQueue = new Queue("notifications", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

export const repoSetupQueue = new Queue("repo-setup", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
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
  return autogradeQueue.add("run-autograde", data, { priority: 1 });
}

export async function enqueueNotification(data: NotificationJobData) {
  return notificationQueue.add("send-notification", data);
}

export async function enqueueRepoSetup(data: RepoSetupJobData) {
  return repoSetupQueue.add("setup-repo", data, { priority: 1 });
}
