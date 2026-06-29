import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isPast } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy h:mm a");
}

export function formatRelative(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function isOverdue(date: Date | string): boolean {
  return isPast(new Date(date));
}

export function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

export function percentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

export function gradeColor(pct: number): string {
  if (pct >= 90) return "text-green-600";
  if (pct >= 75) return "text-blue-600";
  if (pct >= 60) return "text-yellow-600";
  return "text-red-600";
}

export function gradeLabel(pct: number): string {
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function parseCSV(text: string): string[][] {
  return text.split("\n").map((row) =>
    row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""))
  );
}

export const LANGUAGE_LABELS: Record<string, string> = {
  C: "C",
  CPP: "C++",
  JAVA: "Java",
  PYTHON: "Python",
  JAVASCRIPT: "JavaScript",
  TYPESCRIPT: "TypeScript",
  GO: "Go",
  RUST: "Rust",
};

export const LANGUAGE_EXTENSIONS: Record<string, string> = {
  C: ".c",
  CPP: ".cpp",
  JAVA: ".java",
  PYTHON: ".py",
  JAVASCRIPT: ".js",
  TYPESCRIPT: ".ts",
  GO: ".go",
  RUST: ".rs",
};

export const DOCKER_IMAGES: Record<string, string> = {
  C: "gcc:latest",
  CPP: "gcc:latest",
  JAVA: "openjdk:17",
  PYTHON: "python:3.11-slim",
  JAVASCRIPT: "node:20-slim",
  TYPESCRIPT: "node:20-slim",
  GO: "golang:1.21-alpine",
  RUST: "rust:1.75-slim",
};
