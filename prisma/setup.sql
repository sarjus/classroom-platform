-- ============================================================
-- Classroom Platform — Full Schema Setup
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ─── Enums ───────────────────────────────────────────────────

CREATE TYPE "UserRole" AS ENUM (
  'SUPER_ADMIN', 'INSTITUTION_ADMIN', 'FACULTY', 'TEACHING_ASSISTANT', 'STUDENT'
);

CREATE TYPE "AssignmentStatus" AS ENUM (
  'DRAFT', 'PUBLISHED', 'ARCHIVED', 'SCHEDULED'
);

CREATE TYPE "SubmissionStatus" AS ENUM (
  'PENDING', 'ACCEPTED', 'SUBMITTED', 'GRADED', 'LATE', 'MISSED'
);

CREATE TYPE "AutogradeStatus" AS ENUM (
  'QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'ERROR', 'TIMEOUT'
);

CREATE TYPE "NotificationType" AS ENUM (
  'ASSIGNMENT_PUBLISHED', 'DEADLINE_REMINDER', 'LATE_WARNING',
  'AUTOGRADING_COMPLETE', 'FEEDBACK_AVAILABLE', 'GRADE_RELEASED',
  'ANNOUNCEMENT', 'INVITATION'
);

CREATE TYPE "LanguageSupport" AS ENUM (
  'C', 'CPP', 'JAVA', 'PYTHON', 'JAVASCRIPT', 'TYPESCRIPT', 'GO', 'RUST'
);

-- ─── Institution ─────────────────────────────────────────────

CREATE TABLE "Institution" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "slug"      TEXT NOT NULL UNIQUE,
  "logo"      TEXT,
  "website"   TEXT,
  "githubOrg" TEXT,
  "plan"      TEXT NOT NULL DEFAULT 'free',
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "InstitutionSettings" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "institutionId"   TEXT NOT NULL UNIQUE,
  "allowSelfSignup" BOOLEAN NOT NULL DEFAULT false,
  "emailDomain"     TEXT,
  "githubOrgId"     TEXT,
  "smtpConfig"      JSONB,
  "webhookSecret"   TEXT,
  "storageConfig"   JSONB,
  "updatedAt"       TIMESTAMPTZ NOT NULL,
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
);

-- ─── User & Auth ─────────────────────────────────────────────

CREATE TABLE "User" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "email"         TEXT NOT NULL UNIQUE,
  "emailVerified" TIMESTAMPTZ,
  "name"          TEXT,
  "username"      TEXT UNIQUE,
  "image"         TEXT,
  "password"      TEXT,
  "role"          "UserRole" NOT NULL DEFAULT 'STUDENT',
  "githubId"      TEXT UNIQUE,
  "githubToken"   TEXT,
  "googleId"      TEXT UNIQUE,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "institutionId" TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL,
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
);

CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_institutionId_idx" ON "User"("institutionId");

CREATE TABLE "Account" (
  "id"                TEXT NOT NULL PRIMARY KEY,
  "userId"            TEXT NOT NULL,
  "type"              TEXT NOT NULL,
  "provider"          TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token"     TEXT,
  "access_token"      TEXT,
  "expires_at"        INTEGER,
  "token_type"        TEXT,
  "scope"             TEXT,
  "id_token"          TEXT,
  "session_state"     TEXT,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  UNIQUE ("provider", "providerAccountId")
);

CREATE TABLE "Session" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "sessionToken" TEXT NOT NULL UNIQUE,
  "userId"       TEXT NOT NULL,
  "expires"      TIMESTAMPTZ NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE "VerificationToken" (
  "identifier" TEXT NOT NULL,
  "token"      TEXT NOT NULL UNIQUE,
  "expires"    TIMESTAMPTZ NOT NULL,
  UNIQUE ("identifier", "token")
);

-- ─── Department & Course ─────────────────────────────────────

CREATE TABLE "Department" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "name"          TEXT NOT NULL,
  "code"          TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id"),
  UNIQUE ("institutionId", "code")
);

CREATE TABLE "Course" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "name"         TEXT NOT NULL,
  "code"         TEXT NOT NULL,
  "description"  TEXT,
  "departmentId" TEXT NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL,
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id"),
  UNIQUE ("departmentId", "code")
);

-- ─── Classroom ───────────────────────────────────────────────

CREATE TABLE "Classroom" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "code"          TEXT NOT NULL UNIQUE,
  "courseId"      TEXT,
  "instructorId"  TEXT NOT NULL,
  "institutionId" TEXT,
  "semester"      TEXT,
  "year"          INTEGER,
  "isArchived"    BOOLEAN NOT NULL DEFAULT false,
  "githubOrgUrl"  TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL,
  FOREIGN KEY ("instructorId") REFERENCES "User"("id"),
  FOREIGN KEY ("courseId") REFERENCES "Course"("id"),
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
);

CREATE INDEX "Classroom_instructorId_idx" ON "Classroom"("instructorId");
CREATE INDEX "Classroom_code_idx" ON "Classroom"("code");

CREATE TABLE "ClassroomTA" (
  "classroomId" TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "assignedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("classroomId", "userId"),
  FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id"),
  FOREIGN KEY ("userId") REFERENCES "User"("id")
);

CREATE TABLE "Enrollment" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "classroomId" TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "joinedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "studentId"   TEXT,
  FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id"),
  FOREIGN KEY ("userId") REFERENCES "User"("id"),
  UNIQUE ("classroomId", "userId")
);

CREATE INDEX "Enrollment_userId_idx" ON "Enrollment"("userId");

-- ─── Assignment ──────────────────────────────────────────────

CREATE TABLE "Assignment" (
  "id"                  TEXT NOT NULL PRIMARY KEY,
  "title"               TEXT NOT NULL,
  "description"         TEXT,
  "instructions"        TEXT,
  "classroomId"         TEXT NOT NULL,
  "creatorId"           TEXT NOT NULL,
  "status"              "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
  "dueDate"             TIMESTAMPTZ,
  "scheduledPublishAt"  TIMESTAMPTZ,
  "allowLateSubmission" BOOLEAN NOT NULL DEFAULT false,
  "latePenaltyPercent"  INTEGER NOT NULL DEFAULT 0,
  "maxScore"            INTEGER NOT NULL DEFAULT 100,
  "starterRepoUrl"      TEXT,
  "starterRepoRef"      TEXT,
  "language"            "LanguageSupport" NOT NULL DEFAULT 'PYTHON',
  "isGroupAssignment"   BOOLEAN NOT NULL DEFAULT false,
  "maxGroupSize"        INTEGER,
  "attachments"         JSONB,
  "templateRepoName"    TEXT,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL,
  FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id"),
  FOREIGN KEY ("creatorId") REFERENCES "User"("id")
);

CREATE INDEX "Assignment_classroomId_idx" ON "Assignment"("classroomId");
CREATE INDEX "Assignment_status_idx" ON "Assignment"("status");

-- ─── Submission & Commit ─────────────────────────────────────

CREATE TABLE "Submission" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "assignmentId"  TEXT NOT NULL,
  "studentId"     TEXT NOT NULL,
  "status"        "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "repoUrl"       TEXT,
  "repoName"      TEXT,
  "repoId"        TEXT,
  "cloneUrl"      TEXT,
  "defaultBranch" TEXT NOT NULL DEFAULT 'main',
  "acceptedAt"    TIMESTAMPTZ,
  "submittedAt"   TIMESTAMPTZ,
  "lockedAt"      TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL,
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id"),
  FOREIGN KEY ("studentId") REFERENCES "User"("id"),
  UNIQUE ("assignmentId", "studentId")
);

CREATE INDEX "Submission_studentId_idx" ON "Submission"("studentId");
CREATE INDEX "Submission_status_idx" ON "Submission"("status");

CREATE TABLE "Commit" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "submissionId" TEXT NOT NULL,
  "sha"          TEXT NOT NULL,
  "message"      TEXT,
  "authorName"   TEXT,
  "authorEmail"  TEXT,
  "pushedAt"     TIMESTAMPTZ NOT NULL,
  "additions"    INTEGER NOT NULL DEFAULT 0,
  "deletions"    INTEGER NOT NULL DEFAULT 0,
  "filesChanged" INTEGER NOT NULL DEFAULT 0,
  "url"          TEXT,
  FOREIGN KEY ("submissionId") REFERENCES "Submission"("id"),
  UNIQUE ("submissionId", "sha")
);

CREATE INDEX "Commit_submissionId_idx" ON "Commit"("submissionId");

-- ─── Autograding ─────────────────────────────────────────────

CREATE TABLE "AutogradeConfig" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "assignmentId" TEXT NOT NULL UNIQUE,
  "language"     "LanguageSupport" NOT NULL,
  "buildCommand" TEXT,
  "runCommand"   TEXT,
  "timeLimit"    INTEGER NOT NULL DEFAULT 30,
  "memoryLimit"  INTEGER NOT NULL DEFAULT 256,
  "dockerImage"  TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL,
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id")
);

CREATE TABLE "TestCase" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "autogradeConfigId" TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "input"            TEXT,
  "expectedOutput"   TEXT,
  "points"           INTEGER NOT NULL DEFAULT 10,
  "isHidden"         BOOLEAN NOT NULL DEFAULT false,
  "timeout"          INTEGER,
  "compareMode"      TEXT NOT NULL DEFAULT 'exact',
  FOREIGN KEY ("autogradeConfigId") REFERENCES "AutogradeConfig"("id")
);

CREATE INDEX "TestCase_autogradeConfigId_idx" ON "TestCase"("autogradeConfigId");

CREATE TABLE "Autograde" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "submissionId"   TEXT NOT NULL,
  "status"         "AutogradeStatus" NOT NULL DEFAULT 'QUEUED',
  "score"          DOUBLE PRECISION,
  "maxScore"       DOUBLE PRECISION,
  "compilationLog" TEXT,
  "executionLog"   TEXT,
  "testResults"    JSONB,
  "executionTime"  INTEGER,
  "memoryUsed"     INTEGER,
  "commitSha"      TEXT,
  "triggeredAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completedAt"    TIMESTAMPTZ,
  FOREIGN KEY ("submissionId") REFERENCES "Submission"("id")
);

CREATE INDEX "Autograde_submissionId_idx" ON "Autograde"("submissionId");

-- ─── Rubric & Grading ────────────────────────────────────────

CREATE TABLE "Rubric" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "assignmentId" TEXT NOT NULL UNIQUE,
  "totalPoints"  INTEGER NOT NULL DEFAULT 100,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL,
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id")
);

CREATE TABLE "RubricCriteria" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "rubricId"    TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "maxPoints"   INTEGER NOT NULL,
  "order"       INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY ("rubricId") REFERENCES "Rubric"("id")
);

CREATE INDEX "RubricCriteria_rubricId_idx" ON "RubricCriteria"("rubricId");

CREATE TABLE "Grade" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "submissionId" TEXT NOT NULL UNIQUE,
  "graderId"     TEXT NOT NULL,
  "score"        DOUBLE PRECISION NOT NULL,
  "maxScore"     DOUBLE PRECISION NOT NULL,
  "percentage"   DOUBLE PRECISION NOT NULL,
  "isReleased"   BOOLEAN NOT NULL DEFAULT false,
  "notes"        TEXT,
  "gradedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL,
  FOREIGN KEY ("submissionId") REFERENCES "Submission"("id"),
  FOREIGN KEY ("graderId") REFERENCES "User"("id")
);

CREATE TABLE "GradeItem" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "gradeId"    TEXT NOT NULL,
  "criteriaId" TEXT NOT NULL,
  "points"     DOUBLE PRECISION NOT NULL,
  "comment"    TEXT,
  FOREIGN KEY ("gradeId") REFERENCES "Grade"("id"),
  FOREIGN KEY ("criteriaId") REFERENCES "RubricCriteria"("id")
);

CREATE TABLE "Feedback" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "gradeId"    TEXT NOT NULL,
  "authorId"   TEXT NOT NULL,
  "filePath"   TEXT,
  "lineNumber" INTEGER,
  "comment"    TEXT NOT NULL,
  "isResolved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL,
  FOREIGN KEY ("gradeId") REFERENCES "Grade"("id"),
  FOREIGN KEY ("authorId") REFERENCES "User"("id")
);

-- ─── Discussion ──────────────────────────────────────────────

CREATE TABLE "DiscussionThread" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "assignmentId" TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "isPinned"     BOOLEAN NOT NULL DEFAULT false,
  "isResolved"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL,
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id")
);

CREATE TABLE "DiscussionMessage" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "threadId"  TEXT NOT NULL,
  "authorId"  TEXT NOT NULL,
  "content"   TEXT NOT NULL,
  "parentId"  TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL,
  FOREIGN KEY ("threadId") REFERENCES "DiscussionThread"("id"),
  FOREIGN KEY ("authorId") REFERENCES "User"("id"),
  FOREIGN KEY ("parentId") REFERENCES "DiscussionMessage"("id")
);

-- ─── Notifications ───────────────────────────────────────────

CREATE TABLE "Notification" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "type"      "NotificationType" NOT NULL,
  "title"     TEXT NOT NULL,
  "message"   TEXT NOT NULL,
  "link"      TEXT,
  "isRead"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY ("userId") REFERENCES "User"("id")
);

CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- ─── Announcements ───────────────────────────────────────────

CREATE TABLE "Announcement" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "classroomId" TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "content"     TEXT NOT NULL,
  "isPinned"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL,
  FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id")
);

-- ─── Plagiarism ──────────────────────────────────────────────

CREATE TABLE "PlagiarismReport" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "assignmentId"    TEXT NOT NULL,
  "reportedBy"      TEXT NOT NULL,
  "submission1Id"   TEXT NOT NULL,
  "submission2Id"   TEXT NOT NULL,
  "similarityScore" DOUBLE PRECISION NOT NULL,
  "astScore"        DOUBLE PRECISION,
  "tokenScore"      DOUBLE PRECISION,
  "suspiciousFiles" JSONB,
  "status"          TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY ("reportedBy") REFERENCES "User"("id")
);

CREATE INDEX "PlagiarismReport_assignmentId_idx" ON "PlagiarismReport"("assignmentId");

-- ─── Audit Log ───────────────────────────────────────────────

CREATE TABLE "AuditLog" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "userId"     TEXT,
  "action"     TEXT NOT NULL,
  "resource"   TEXT NOT NULL,
  "resourceId" TEXT,
  "details"    JSONB,
  "ipAddress"  TEXT,
  "userAgent"  TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY ("userId") REFERENCES "User"("id")
);

CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- ─── Prisma migration tracking ───────────────────────────────

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id"                   TEXT NOT NULL PRIMARY KEY,
  "checksum"             TEXT NOT NULL,
  "finished_at"          TIMESTAMPTZ,
  "migration_name"       TEXT NOT NULL,
  "logs"                 TEXT,
  "rolled_back_at"       TIMESTAMPTZ,
  "started_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count"  INTEGER NOT NULL DEFAULT 0
);
