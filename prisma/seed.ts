/**
 * Database Seed Script
 * Run: npx tsx prisma/seed.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Create institution
  const institution = await prisma.institution.upsert({
    where: { slug: "tech-university" },
    update: {},
    create: {
      name: "Tech University",
      slug: "tech-university",
      plan: "pro",
    },
  });
  console.log("✅ Institution created");

  // Create users
  const adminPassword = await bcrypt.hash("Admin1234!", 12);
  const studentPassword = await bcrypt.hash("Student123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@techuniversity.edu" },
    update: {},
    create: {
      name: "Dr. Admin User",
      email: "admin@techuniversity.edu",
      password: adminPassword,
      role: "FACULTY",
      institutionId: institution.id,
    },
  });

  const ta = await prisma.user.upsert({
    where: { email: "ta@techuniversity.edu" },
    update: {},
    create: {
      name: "Teaching Assistant",
      email: "ta@techuniversity.edu",
      password: adminPassword,
      role: "TEACHING_ASSISTANT",
      institutionId: institution.id,
    },
  });

  const students = await Promise.all(
    [
      { name: "Alice Johnson", email: "alice@student.edu" },
      { name: "Bob Smith", email: "bob@student.edu" },
      { name: "Charlie Brown", email: "charlie@student.edu" },
      { name: "Diana Prince", email: "diana@student.edu" },
      { name: "Eve Wilson", email: "eve@student.edu" },
    ].map((s) =>
      prisma.user.upsert({
        where: { email: s.email },
        update: {},
        create: { ...s, password: studentPassword, role: "STUDENT", institutionId: institution.id },
      })
    )
  );
  console.log(`✅ Created ${students.length} students`);

  // Create department and course
  const dept = await prisma.department.upsert({
    where: { institutionId_code: { institutionId: institution.id, code: "CS" } },
    update: {},
    create: { name: "Computer Science", code: "CS", institutionId: institution.id },
  });

  const course = await prisma.course.upsert({
    where: { departmentId_code: { departmentId: dept.id, code: "CS101" } },
    update: {},
    create: { name: "Introduction to Programming", code: "CS101", departmentId: dept.id },
  });

  // Create classroom
  const classroom = await prisma.classroom.upsert({
    where: { code: "CS2026A" },
    update: {},
    create: {
      name: "CS101 - Fall 2026",
      description: "Introduction to Programming with Python",
      code: "CS2026A",
      instructorId: admin.id,
      courseId: course.id,
      institutionId: institution.id,
      semester: "Fall",
      year: 2026,
    },
  });

  // Enroll students
  for (const student of students) {
    await prisma.enrollment.upsert({
      where: { classroomId_userId: { classroomId: classroom.id, userId: student.id } },
      update: {},
      create: { classroomId: classroom.id, userId: student.id },
    });
  }
  console.log("✅ Students enrolled");

  // Create assignment
  const assignment = await prisma.assignment.create({
    data: {
      title: "Linked List Implementation",
      description: "Implement a singly linked list in Python",
      instructions: `# Linked List Assignment

## Overview
Implement a singly linked list data structure with the following operations:

## Requirements
1. \`append(value)\` — Add element to end
2. \`prepend(value)\` — Add element to beginning
3. \`delete(value)\` — Remove first occurrence
4. \`search(value)\` — Return True if found
5. \`to_list()\` — Convert to Python list

## Grading
- Correctness: 60 points
- Code Quality: 20 points
- Documentation: 20 points`,
      classroomId: classroom.id,
      creatorId: admin.id,
      status: "PUBLISHED",
      language: "PYTHON",
      maxScore: 100,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
      allowLateSubmission: true,
      latePenaltyPercent: 10,
    },
  });

  // Create rubric
  await prisma.rubric.create({
    data: {
      assignmentId: assignment.id,
      totalPoints: 100,
      criteria: {
        create: [
          { title: "Correctness", description: "All test cases pass", maxPoints: 60, order: 0 },
          { title: "Code Quality", description: "Clean, readable code", maxPoints: 20, order: 1 },
          { title: "Documentation", description: "Comments and docstrings", maxPoints: 20, order: 2 },
        ],
      },
    },
  });

  // Create autograding config
  await prisma.autogradeConfig.create({
    data: {
      assignmentId: assignment.id,
      language: "PYTHON",
      runCommand: "python solution.py",
      timeLimit: 30,
      memoryLimit: 256,
      testCases: {
        create: [
          {
            name: "Test append",
            input: "",
            expectedOutput: "[1, 2, 3]",
            points: 15,
            compareMode: "exact",
          },
          {
            name: "Test prepend",
            input: "",
            expectedOutput: "[0, 1, 2, 3]",
            points: 15,
            compareMode: "exact",
          },
          {
            name: "Test delete",
            input: "",
            expectedOutput: "[1, 3]",
            points: 15,
            isHidden: false,
            compareMode: "exact",
          },
          {
            name: "Hidden test - edge cases",
            input: "",
            expectedOutput: "pass",
            points: 15,
            isHidden: true,
            compareMode: "contains",
          },
        ],
      },
    },
  });

  console.log("✅ Assignment, rubric, and autograding config created");
  console.log("\n📋 Seed Summary:");
  console.log(`   Institution: ${institution.name}`);
  console.log(`   Faculty: ${admin.email} (password: Admin1234!)`);
  console.log(`   TA: ${ta.email} (password: Admin1234!)`);
  console.log(`   Students: alice, bob, charlie, diana, eve @student.edu (password: Student123!)`);
  console.log(`   Classroom join code: CS2026A`);
  console.log(`   Assignment: "${assignment.title}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
