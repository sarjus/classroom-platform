// Local type definitions replacing @prisma/client enums

export type UserRole =
  | "SUPER_ADMIN"
  | "INSTITUTION_ADMIN"
  | "FACULTY"
  | "TEACHING_ASSISTANT"
  | "STUDENT";

export type AssignmentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SCHEDULED";

export type SubmissionStatus =
  | "PENDING"
  | "ACCEPTED"
  | "SUBMITTED"
  | "GRADED"
  | "LATE"
  | "MISSED";

export type AutogradeStatus =
  | "QUEUED"
  | "RUNNING"
  | "PASSED"
  | "FAILED"
  | "ERROR"
  | "TIMEOUT";

export type NotificationType =
  | "ASSIGNMENT_PUBLISHED"
  | "DEADLINE_REMINDER"
  | "LATE_WARNING"
  | "AUTOGRADING_COMPLETE"
  | "FEEDBACK_AVAILABLE"
  | "GRADE_RELEASED"
  | "ANNOUNCEMENT"
  | "INVITATION";

export type LanguageSupport =
  | "C"
  | "CPP"
  | "JAVA"
  | "PYTHON"
  | "JAVASCRIPT"
  | "TYPESCRIPT"
  | "GO"
  | "RUST";

// DB row types
export interface User {
  id: string;
  email: string;
  emailVerified?: string | null;
  name?: string | null;
  username?: string | null;
  image?: string | null;
  password?: string | null;
  role: UserRole;
  githubId?: string | null;
  githubToken?: string | null;
  googleId?: string | null;
  isActive: boolean;
  institutionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Institution {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  website?: string | null;
  githubOrg?: string | null;
  plan: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Classroom {
  id: string;
  name: string;
  description?: string | null;
  code: string;
  courseId?: string | null;
  instructorId: string;
  institutionId?: string | null;
  semester?: string | null;
  year?: number | null;
  isArchived: boolean;
  githubOrgUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  id: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  classroomId: string;
  creatorId: string;
  status: AssignmentStatus;
  dueDate?: string | null;
  scheduledPublishAt?: string | null;
  allowLateSubmission: boolean;
  latePenaltyPercent: number;
  maxScore: number;
  starterRepoUrl?: string | null;
  starterRepoRef?: string | null;
  language: LanguageSupport;
  isGroupAssignment: boolean;
  maxGroupSize?: number | null;
  attachments?: unknown;
  templateRepoName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  status: SubmissionStatus;
  repoUrl?: string | null;
  repoName?: string | null;
  repoId?: string | null;
  cloneUrl?: string | null;
  defaultBranch: string;
  acceptedAt?: string | null;
  submittedAt?: string | null;
  lockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Grade {
  id: string;
  submissionId: string;
  graderId: string;
  score: number;
  maxScore: number;
  percentage: number;
  isReleased: boolean;
  notes?: string | null;
  gradedAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface Enrollment {
  id: string;
  classroomId: string;
  userId: string;
  joinedAt: string;
  isActive: boolean;
  studentId?: string | null;
}

export interface Rubric {
  id: string;
  assignmentId: string;
  totalPoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface RubricCriteria {
  id: string;
  rubricId: string;
  title: string;
  description?: string | null;
  maxPoints: number;
  order: number;
}

export interface GradeItem {
  id: string;
  gradeId: string;
  criteriaId: string;
  points: number;
  comment?: string | null;
}

export interface Feedback {
  id: string;
  gradeId: string;
  authorId: string;
  filePath?: string | null;
  lineNumber?: number | null;
  comment: string;
  isResolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Autograde {
  id: string;
  submissionId: string;
  status: AutogradeStatus;
  score?: number | null;
  maxScore?: number | null;
  compilationLog?: string | null;
  executionLog?: string | null;
  testResults?: unknown;
  executionTime?: number | null;
  memoryUsed?: number | null;
  commitSha?: string | null;
  triggeredAt: string;
  completedAt?: string | null;
}

export interface Commit {
  id: string;
  submissionId: string;
  sha: string;
  message?: string | null;
  authorName?: string | null;
  authorEmail?: string | null;
  pushedAt: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  url?: string | null;
}

export interface AutogradeConfig {
  id: string;
  assignmentId: string;
  language: LanguageSupport;
  buildCommand?: string | null;
  runCommand?: string | null;
  timeLimit: number;
  memoryLimit: number;
  dockerImage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestCase {
  id: string;
  autogradeConfigId: string;
  name: string;
  input?: string | null;
  expectedOutput?: string | null;
  points: number;
  isHidden: boolean;
  timeout?: number | null;
  compareMode: string;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}
