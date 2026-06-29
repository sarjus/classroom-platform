import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const createClassroomSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  description: z.string().max(500).optional(),
  semester: z.string().optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  courseId: z.string().optional(),
});

export const createAssignmentSchema = z.object({
  title: z.string().min(3, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  instructions: z.string().optional(),
  classroomId: z.string(),
  dueDate: z.string().optional(),
  allowLateSubmission: z.boolean(),
  latePenaltyPercent: z.number().int().min(0).max(100),
  maxScore: z.number().int().min(1).max(1000),
  starterRepoUrl: z.string().url().optional().or(z.literal("")),
  language: z.enum(["C", "CPP", "JAVA", "PYTHON", "JAVASCRIPT", "TYPESCRIPT", "GO", "RUST"]),
  isGroupAssignment: z.boolean(),
  maxGroupSize: z.number().int().min(2).max(10).optional(),
});

export const rubricSchema = z.object({
  assignmentId: z.string(),
  totalPoints: z.number().int().min(1).max(1000).default(100),
  criteria: z.array(
    z.object({
      title: z.string().min(1, "Criterion title required"),
      description: z.string().optional(),
      maxPoints: z.number().int().min(0),
      order: z.number().default(0),
    })
  ).min(1, "At least one criterion required"),
});

export const autogradeConfigSchema = z.object({
  assignmentId: z.string(),
  language: z.enum(["C", "CPP", "JAVA", "PYTHON", "JAVASCRIPT", "TYPESCRIPT", "GO", "RUST"]),
  buildCommand: z.string().optional(),
  runCommand: z.string().optional(),
  timeLimit: z.number().int().min(1).max(300).default(30),
  memoryLimit: z.number().int().min(64).max(2048).default(256),
  testCases: z.array(
    z.object({
      name: z.string().min(1),
      input: z.string().optional(),
      expectedOutput: z.string().optional(),
      points: z.number().int().min(0).default(10),
      isHidden: z.boolean().default(false),
      timeout: z.number().int().optional(),
      compareMode: z.enum(["exact", "contains", "regex"]).default("exact"),
    })
  ),
});

export const gradeSchema = z.object({
  submissionId: z.string(),
  items: z.array(
    z.object({
      criteriaId: z.string(),
      points: z.number().min(0),
      comment: z.string().optional(),
    })
  ),
  notes: z.string().optional(),
  isReleased: z.boolean().default(false),
});

export const feedbackSchema = z.object({
  gradeId: z.string(),
  filePath: z.string().optional(),
  lineNumber: z.coerce.number().int().optional(),
  comment: z.string().min(1, "Comment is required"),
});

export const joinClassroomSchema = z.object({
  code: z.string().min(4).max(10).toUpperCase(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateClassroomInput = z.infer<typeof createClassroomSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type RubricInput = z.infer<typeof rubricSchema>;
export type AutogradeConfigInput = z.infer<typeof autogradeConfigSchema>;
export type GradeInput = z.infer<typeof gradeSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type JoinClassroomInput = z.infer<typeof joinClassroomSchema>;
