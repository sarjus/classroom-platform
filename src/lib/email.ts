import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(opts: EmailOptions) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "ClassroomHub <no-reply@classroom.example.com>",
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

export function assignmentPublishedEmail(
  studentName: string,
  assignmentTitle: string,
  classroomName: string,
  dueDate: string,
  link: string
): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">New Assignment: ${assignmentTitle}</h2>
      <p>Hi ${studentName},</p>
      <p>A new assignment has been published in <strong>${classroomName}</strong>.</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; font-weight: bold;">Assignment:</td>
          <td style="padding: 8px;">${assignmentTitle}</td>
        </tr>
        <tr style="background: #f5f5f5;">
          <td style="padding: 8px; font-weight: bold;">Due Date:</td>
          <td style="padding: 8px;">${dueDate}</td>
        </tr>
      </table>
      <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
        View Assignment
      </a>
      <p style="color: #666; font-size: 12px; margin-top: 24px;">ClassroomHub Platform</p>
    </div>
  `;
}

export function deadlineReminderEmail(
  studentName: string,
  assignmentTitle: string,
  dueDate: string,
  link: string
): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">⏰ Deadline Reminder</h2>
      <p>Hi ${studentName},</p>
      <p>The assignment <strong>${assignmentTitle}</strong> is due soon.</p>
      <p><strong>Due Date:</strong> ${dueDate}</p>
      <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px;">
        Submit Now
      </a>
      <p style="color: #666; font-size: 12px; margin-top: 24px;">ClassroomHub Platform</p>
    </div>
  `;
}

export function gradeFeedbackEmail(
  studentName: string,
  assignmentTitle: string,
  score: number,
  maxScore: number,
  link: string
): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">📝 Grade Available</h2>
      <p>Hi ${studentName},</p>
      <p>Your submission for <strong>${assignmentTitle}</strong> has been graded.</p>
      <p style="font-size: 24px; font-weight: bold; color: #1a1a2e;">
        ${score} / ${maxScore} (${Math.round((score / maxScore) * 100)}%)
      </p>
      <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #16a34a; color: white; text-decoration: none; border-radius: 6px;">
        View Feedback
      </a>
      <p style="color: #666; font-size: 12px; margin-top: 24px;">ClassroomHub Platform</p>
    </div>
  `;
}
