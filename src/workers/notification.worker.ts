/**
 * Notification Worker
 * Run separately: npx tsx src/workers/notification.worker.ts
 */

import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { sendEmail, assignmentPublishedEmail, deadlineReminderEmail, gradeFeedbackEmail } from "../lib/email";
import type { NotificationJobData } from "../lib/queue";
import type { NotificationType } from "../types/db";

async function runNotificationJob(job: Job<NotificationJobData>) {
  const { userId, type, title, message, link, email } = job.data;

  // Save in-app notification
  await prisma.notification.create({
    data: {
      userId,
      type: type as NotificationType,
      title,
      message,
      link,
    },
  });

  // Send email if provided
  if (email) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      const name = user?.name ?? "Student";
      const appUrl = process.env.APP_URL ?? "http://localhost:3000";
      const fullLink = link ? `${appUrl}${link}` : appUrl;

      let html: string;
      switch (type) {
        case "ASSIGNMENT_PUBLISHED":
          html = assignmentPublishedEmail(name, message, "Classroom", "See platform", fullLink);
          break;
        case "DEADLINE_REMINDER":
          html = deadlineReminderEmail(name, message, "See platform", fullLink);
          break;
        case "GRADE_RELEASED":
          html = gradeFeedbackEmail(name, message, 0, 100, fullLink);
          break;
        default:
          html = `<p>${message}</p><a href="${fullLink}">View on ClassroomHub</a>`;
      }

      await sendEmail({ to: email, subject: title, html });
      console.log(`[notifications] Email sent to ${email}`);
    } catch (err) {
      console.error(`[notifications] Email failed for ${email}:`, err);
      // Don't fail the job — in-app notification was already saved
    }
  }
}

const worker = new Worker<NotificationJobData>("notifications", runNotificationJob, {
  connection: redis,
  concurrency: 20,
});

worker.on("completed", (job) => {
  console.log(`[notifications] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[notifications] Job ${job?.id} failed:`, err.message);
});

console.log("[notifications] Worker started");

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
