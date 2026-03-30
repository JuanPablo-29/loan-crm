import type { Pool } from "pg";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Merge lines until a line ends with `;` — matches this project's schema.sql (no semicolons inside strings). */
export function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const line of sql.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("--")) continue;
    cur += (cur ? "\n" : "") + line;
    if (/;\s*$/.test(line)) {
      const stmt = cur.trim();
      if (stmt.length > 0) out.push(stmt);
      cur = "";
    }
  }
  const tail = cur.trim();
  if (tail.length > 0) out.push(tail);
  return out;
}

export function loadSchemaSql(): string {
  return readFileSync(join(__dirname, "schema.sql"), "utf-8");
}

/**
 * Run each statement in its own transaction so a failing ALTER does not roll back CREATE TABLE.
 * (PostgreSQL treats multiple statements in one simple query as a single implicit transaction.)
 */
export async function applySchema(pool: Pool): Promise<void> {
  const statements = splitSqlStatements(loadSchemaSql());
  for (const stmt of statements) {
    const text = stmt.endsWith(";") ? stmt : `${stmt};`;
    await pool.query(text);
  }
}

export async function assertLeadsTable(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ rel: string | null }>(
    `SELECT to_regclass('public.leads')::text AS rel`
  );
  if (!rows[0]?.rel) {
    throw new Error(
      'Database is missing table "leads". Check DATABASE_URL and run: npm run migrate -w server'
    );
  }
}
