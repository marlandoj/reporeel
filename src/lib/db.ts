import { Database } from "bun:sqlite";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";

const ROOT = join(import.meta.dir, "..", "..");
export const DATA_DIR = process.env.REPOREEL_DATA_DIR ?? join(ROOT, "data");
export const JOBS_DIR = join(DATA_DIR, "jobs");

mkdirSync(JOBS_DIR, { recursive: true });
export const db = new Database(join(DATA_DIR, "reporeel.db"));
db.run("PRAGMA journal_mode = WAL");

db.run(`CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  canonical TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  title TEXT,
  total REAL,
  ip TEXT,
  created_at INTEGER NOT NULL
)`);

const ADDED_COLUMNS: [string, string][] = [
  ["options", "TEXT"],
  ["variant", "TEXT"],
  ["format", "TEXT"],
  ["kind", "TEXT"],
  ["owner_hash", "TEXT"],
  ["phase", "TEXT"],
  ["cancel_requested", "INTEGER NOT NULL DEFAULT 0"],
  ["progress_done", "INTEGER"],
  ["progress_total", "INTEGER"],
  ["stage_started_at", "INTEGER"],
  ["source_pushed_at", "TEXT"],
  ["source_tag", "TEXT"],
  ["views", "INTEGER NOT NULL DEFAULT 0"],
  ["size_bytes", "INTEGER"],
  ["pinned", "INTEGER NOT NULL DEFAULT 0"],
  ["warnings", "TEXT"],
  ["rewrites", "INTEGER NOT NULL DEFAULT 0"],
  ["finished_at", "INTEGER"],
];

const existing = new Set((db.query("PRAGMA table_info(jobs)").all() as { name: string }[]).map((r) => r.name));
for (const [name, type] of ADDED_COLUMNS) {
  if (!existing.has(name)) db.run(`ALTER TABLE jobs ADD COLUMN ${name} ${type}`);
}
db.run(`CREATE INDEX IF NOT EXISTS idx_jobs_canonical ON jobs(canonical)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_jobs_ip ON jobs(ip, created_at)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, created_at)`);

const LEGACY_OPTIONS = JSON.stringify({ grounding: "both", format: "landscape", captions: false, review: false });
db.run("UPDATE jobs SET variant = 'landscape:both:nocc', format = 'landscape', options = ?, kind = CASE WHEN canonical LIKE '%#%' THEN 'pr' ELSE 'repo' END WHERE variant IS NULL", [LEGACY_OPTIONS]);
db.run("UPDATE jobs SET status = 'queued', phase = 'render' WHERE status IN ('voicing','rendering')");
db.run("UPDATE jobs SET status = 'queued' WHERE status IN ('ingesting','scripting')");

export type Job = {
  id: string;
  url: string;
  canonical: string;
  status: string;
  error: string | null;
  title: string | null;
  total: number | null;
  ip: string | null;
  created_at: number;
  options: string | null;
  variant: string | null;
  format: string | null;
  kind: string | null;
  owner_hash: string | null;
  phase: string | null;
  cancel_requested: number;
  progress_done: number | null;
  progress_total: number | null;
  stage_started_at: number | null;
  source_pushed_at: string | null;
  source_tag: string | null;
  views: number;
  size_bytes: number | null;
  pinned: number;
  warnings: string | null;
  rewrites: number;
  finished_at: number | null;
};

export const ACTIVE_STATUSES = ["queued", "ingesting", "scripting", "voicing", "rendering"];
export const TERMINAL_STATUSES = ["done", "error", "cancelled", "expired"];

const COLUMNS = [
  "id", "url", "canonical", "status", "error", "title", "total", "ip", "created_at",
  ...ADDED_COLUMNS.map(([n]) => n),
];
const SELECT = `SELECT ${COLUMNS.join(",")} FROM jobs`;
const UPDATABLE = new Set(COLUMNS.filter((c) => c !== "id" && c !== "created_at"));

export function getJob(id: string): Job | null {
  return db.query(`${SELECT} WHERE id = ?`).get(id) as Job | null;
}

export function listJobs(where: string, params: (string | number)[] = []): Job[] {
  return db.query(`${SELECT} WHERE ${where}`).all(...params) as Job[];
}

export function updateJob(id: string, patch: Partial<Job>): void {
  const keys = Object.keys(patch).filter((k) => UPDATABLE.has(k));
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => (patch as Record<string, unknown>)[k] as string | number | null);
  db.run(`UPDATE jobs SET ${sets} WHERE id = ?`, [...values, id]);
}

export function newId(): string {
  return randomBytes(6).toString("base64url");
}

export function newOwnerToken(): string {
  return randomBytes(18).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function jobDirFor(id: string): string {
  return join(JOBS_DIR, id);
}
