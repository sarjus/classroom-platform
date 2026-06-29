import path from "node:path";
import type { PrismaConfig } from "prisma";
import { config } from "dotenv";

// Load .env.local (Next.js convention) from the project root
config({ path: path.resolve(__dirname, ".env.local") });

export default {
  schema: path.resolve(__dirname, "prisma/schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL,
  },
} satisfies PrismaConfig;
