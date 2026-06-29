import path from "node:path";
import type { PrismaConfig } from "prisma";

// Load .env.local since Next.js uses that instead of .env
import { config } from "dotenv";
config({ path: path.join(__dirname, "../.env.local") });

export default {
  schema: path.join(__dirname, "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
} satisfies PrismaConfig;
