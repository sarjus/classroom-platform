/**
 * Compatibility shim — re-exports the Supabase admin client
 * with a Prisma-like query API so existing code keeps working.
 *
 * All `prisma.table.operation()` calls are mapped to
 * Supabase PostgREST queries against the same table names.
 */
import { supabaseAdmin } from "./supabase";
import { generateCuid } from "./cuid";

type WhereInput = Record<string, unknown>;
type OrderByInput = Record<string, "asc" | "desc">;

// ── helpers ──────────────────────────────────────────────────────────────────

function applyWhere(query: ReturnType<typeof supabaseAdmin.from>, where: WhereInput = {}) {
  let q = query;
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      if ("in" in obj) { q = (q as any).in(key, obj.in); continue; }
      if ("not" in obj) { q = (q as any).neq(key, (obj.not as Record<string, unknown>)?.id ?? obj.not); continue; }
      if ("some" in obj) continue; // relational — handled per-model
      if ("gt" in obj) { q = (q as any).gt(key, obj.gt); continue; }
      if ("gte" in obj) { q = (q as any).gte(key, obj.gte); continue; }
      if ("lt" in obj) { q = (q as any).lt(key, obj.lt); continue; }
      if ("lte" in obj) { q = (q as any).lte(key, obj.lte); continue; }
    }
    q = (q as any).eq(key, value);
  }
  return q;
}

function applyOrder(query: ReturnType<typeof supabaseAdmin.from>, orderBy: OrderByInput | OrderByInput[] = {}) {
  let q = query;
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  for (const order of orders) {
    for (const [col, dir] of Object.entries(order)) {
      q = (q as any).order(col, { ascending: dir === "asc" });
    }
  }
  return q;
}

// Build a select string from Prisma-style select/include
function buildSelect(select?: Record<string, unknown>, include?: Record<string, unknown>): string {
  if (!select && !include) return "*";
  const parts: string[] = [];
  if (select) {
    for (const [key, val] of Object.entries(select)) {
      if (val === true) parts.push(key);
    }
  }
  return parts.length ? parts.join(",") : "*";
}

// ── model builder ─────────────────────────────────────────────────────────────

function model(tableName: string) {
  const tbl = () => supabaseAdmin.from(tableName);

  return {
    async findUnique({ where, select, include }: { where: WhereInput; select?: Record<string, unknown>; include?: Record<string, unknown> }) {
      let q = applyWhere(tbl().select(buildSelect(select, include)), where);
      q = (q as any).limit(1).maybeSingle();
      const { data, error } = await (q as any);
      if (error) throw new Error(`[${tableName}.findUnique] ${error.message}`);
      return data;
    },

    async findFirst({ where, select, include, orderBy }: { where?: WhereInput; select?: Record<string, unknown>; include?: Record<string, unknown>; orderBy?: OrderByInput | OrderByInput[] }) {
      let q = applyWhere(tbl().select(buildSelect(select, include)), where);
      q = applyOrder(q, orderBy);
      q = (q as any).limit(1).maybeSingle();
      const { data, error } = await (q as any);
      if (error) throw new Error(`[${tableName}.findFirst] ${error.message}`);
      return data;
    },

    async findMany({ where, select, include, orderBy, skip, take }: {
      where?: WhereInput; select?: Record<string, unknown>; include?: Record<string, unknown>;
      orderBy?: OrderByInput | OrderByInput[]; skip?: number; take?: number;
    } = {}) {
      let q = applyWhere(tbl().select(buildSelect(select, include)), where);
      q = applyOrder(q, orderBy);
      if (skip !== undefined || take !== undefined) {
        const from = skip ?? 0;
        const to = take !== undefined ? from + take - 1 : 999999;
        q = (q as any).range(from, to);
      }
      const { data, error } = await (q as any);
      if (error) throw new Error(`[${tableName}.findMany] ${error.message}`);
      return data ?? [];
    },

    async count({ where }: { where?: WhereInput } = {}) {
      let q = applyWhere(tbl().select("*", { count: "exact", head: true }), where);
      const { count, error } = await (q as any);
      if (error) throw new Error(`[${tableName}.count] ${JSON.stringify(error)}`);
      return count ?? 0;
    },

    async create({ data, select }: { data: Record<string, unknown>; select?: Record<string, unknown> }) {
      const row = { id: generateCuid(), ...data };
      // Flatten nested create relations
      const nested: Record<string, unknown> = {};
      const flat: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === "object" && v !== null && "create" in (v as Record<string, unknown>)) {
          nested[k] = v;
        } else {
          flat[k] = v;
        }
      }
      const { data: inserted, error } = await tbl()
        .insert(flat)
        .select(buildSelect(select))
        .single();
      if (error) throw new Error(`[${tableName}.create] ${error.message}`);
      // Handle nested creates
      for (const [rel, relVal] of Object.entries(nested)) {
        const relData = (relVal as Record<string, unknown>).create;
        const items = Array.isArray(relData) ? relData : [relData];
        const relTable = rel; // assume table name matches relation key
        for (const item of items) {
          await supabaseAdmin.from(relTable).insert({ id: generateCuid(), ...item as object });
        }
      }
      return inserted;
    },

    async update({ where, data, select }: { where: WhereInput; data: Record<string, unknown>; select?: Record<string, unknown> }) {
      // Strip nested creates/connects from update data
      const flat: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) {
        if (typeof v !== "object" || v === null || (!("create" in (v as object)) && !("connect" in (v as object)))) {
          flat[k] = v;
        }
      }
      let q = applyWhere(tbl().update(flat), where);
      q = (q as any).select(buildSelect(select));
      if (Object.keys(where).length === 1) q = (q as any).single();
      const { data: updated, error } = await (q as any);
      if (error) throw new Error(`[${tableName}.update] ${error.message}`);
      return updated;
    },

    async updateMany({ where, data }: { where?: WhereInput; data: Record<string, unknown> }) {
      let q = applyWhere(tbl().update(data), where);
      const { error } = await (q as any);
      if (error) throw new Error(`[${tableName}.updateMany] ${error.message}`);
      return { count: 1 };
    },

    async upsert({ where, create, update }: { where: WhereInput; create: Record<string, unknown>; update: Record<string, unknown> }) {
      const existing = await this.findFirst({ where });
      if (existing) {
        return this.update({ where, data: update });
      }
      return this.create({ data: { ...create } });
    },

    async delete({ where }: { where: WhereInput }) {
      let q = applyWhere(tbl().delete(), where);
      const { data, error } = await (q as any).select().single();
      if (error) throw new Error(`[${tableName}.delete] ${error.message}`);
      return data;
    },

    async deleteMany({ where }: { where?: WhereInput } = {}) {
      let q = applyWhere(tbl().delete(), where);
      const { error } = await (q as any);
      if (error) throw new Error(`[${tableName}.deleteMany] ${error.message}`);
      return { count: 1 };
    },
  };
}

// ── prisma-compatible client ──────────────────────────────────────────────────

const db = {
  user: model("User"),
  account: model("Account"),
  session: model("Session"),
  verificationToken: model("VerificationToken"),
  institution: model("Institution"),
  institutionSettings: model("InstitutionSettings"),
  department: model("Department"),
  course: model("Course"),
  classroom: model("Classroom"),
  classroomTA: model("ClassroomTA"),
  enrollment: model("Enrollment"),
  assignment: model("Assignment"),
  submission: model("Submission"),
  commit: model("Commit"),
  autogradeConfig: model("AutogradeConfig"),
  testCase: model("TestCase"),
  autograde: model("Autograde"),
  rubric: model("Rubric"),
  rubricCriteria: model("RubricCriteria"),
  grade: model("Grade"),
  gradeItem: model("GradeItem"),
  feedback: model("Feedback"),
  notification: model("Notification"),
  announcement: model("Announcement"),
  plagiarismReport: model("PlagiarismReport"),
  auditLog: model("AuditLog"),
  $disconnect: async () => {},
};

export const prisma = db;
export default db;
