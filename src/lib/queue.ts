import { Database } from "bun:sqlite";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { parseTarget, canonical } from "./github";
import { runPipeline } from "./pipeline";
import { log } from "./log";

const ROOT = join(import.meta.dir, "..", "..");
export const DATA_DIR = join(ROOT, "data");
export const JOBS_DIR = join(DATA_DIR, "jobs");

const RATE_LIMIT_PER_HOUR = Number(process.env.REPOREEL_RATE_LIMIT ?? 3);
const MAX_QUEUE_DEPTH = Number(process.env.REPOREEL_MAX_QUEUE ?? 6);
const ACTIVE = ["queued", "ingesting", "scripting", "voicing", "rendering"];

mkdirSync(JOBS_DIR, { recursive: true });
const db = new Database(join(DATA_DIR, "reporeel.db"));
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
db.run(`CREATE INDEX IF NOT EXISTS idx_jobs_canonical ON jobs(canonical)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_jobs_ip ON jobs(ip, created_at)`);
db.run(`UPDATE jobs SET status = 'queued' WHERE status IN ('ingesting','scripting','voicing','rendering')`);

export type Job = {
  id: string;
  url: string;
  canonical: string;
  status: string;
  error: string | null;
  title: string | null;
  total: number | null;
  created_at: number;
};

function newId(): string {
  return randomBytes(6).toString("base64url");
}

export function getJob(id: string): Job | null {
  return db.query("SELECT id,url,canonical,status,error,title,total,created_at FROM jobs WHERE id = ?").get(id) as Job | null;
}

export function queuePosition(id: string): number {
  const job = getJob(id);
  if (!job || job.status !== "queued") return 0;
  const row = db
    .query("SELECT COUNT(*) as n FROM jobs WHERE status IN ('queued','ingesting','scripting','voicing','rendering') AND created_at < ?")
    .get(job.created_at) as { n: number };
  return row.n;
}

export function submitJob(url: string, ip: string): { id: string; cached: boolean } {
  const target = parseTarget(url);
  if (!target) throw new Error("That does not look like a public GitHub repo or PR URL.");
  const canon = canonical(target);
  const done = db
    .query("SELECT id FROM jobs WHERE canonical = ? AND status = 'done' ORDER BY created_at DESC LIMIT 1")
    .get(canon) as { id: string } | null;
  if (done) return { id: done.id, cached: true };
  const active = db
    .query(`SELECT id FROM jobs WHERE canonical = ? AND status IN (${ACTIVE.map(() => "?").join(",")}) LIMIT 1`)
    .get(canon, ...ACTIVE) as { id: string } | null;
  if (active) return { id: active.id, cached: false };
  const hourAgo = Date.now() - 3600_000;
  const byIp = db.query("SELECT COUNT(*) as n FROM jobs WHERE ip = ? AND created_at > ?").get(ip, hourAgo) as { n: number };
  if (byIp.n >= RATE_LIMIT_PER_HOUR)
    throw new Error(`Rate limit: ${RATE_LIMIT_PER_HOUR} new videos per hour per visitor. Try again soon.`);
  const depth = db
    .query(`SELECT COUNT(*) as n FROM jobs WHERE status IN (${ACTIVE.map(() => "?").join(",")})`)
    .get(...ACTIVE) as { n: number };
  if (depth.n >= MAX_QUEUE_DEPTH) throw new Error("The queue is full right now. Try again in a few minutes.");
  const id = newId();
  db.run("INSERT INTO jobs (id,url,canonical,status,ip,created_at) VALUES (?,?,?,?,?,?)", [
    id, url.trim(), canon, "queued", ip, Date.now(),
  ]);
  return { id, cached: false };
}

export function recentDone(limit = 12): Job[] {
  return db
    .query("SELECT id,url,canonical,status,error,title,total,created_at FROM jobs WHERE status = 'done' ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Job[];
}

function setStatus(id: string, status: string, extra: Partial<Job> = {}): void {
  db.run("UPDATE jobs SET status = ?, error = COALESCE(?, error), title = COALESCE(?, title), total = COALESCE(?, total) WHERE id = ?", [
    status, extra.error ?? null, extra.title ?? null, extra.total ?? null, id,
  ]);
}

let workerRunning = false;

async function workOne(): Promise<boolean> {
  const next = db.query("SELECT id, url FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1").get() as
    | { id: string; url: string }
    | null;
  if (!next) return false;
  const jobDir = join(JOBS_DIR, next.id);
  try {
    const result = await runPipeline(next.url, jobDir, (stage) => setStatus(next.id, stage));
    setStatus(next.id, "done", { title: result.title, total: result.total });
    log(`job ${next.id} done: ${result.canonical}`);
  } catch (e: any) {
    setStatus(next.id, "error", { error: String(e?.message ?? e).slice(0, 400) });
    log(`job ${next.id} failed: ${e}`);
  }
  return true;
}

export function startWorker(): void {
  if (workerRunning) return;
  workerRunning = true;
  (async () => {
    for (;;) {
      try {
        const did = await workOne();
        if (!did) await Bun.sleep(1500);
      } catch (e) {
        log(`worker loop error: ${e}`);
        await Bun.sleep(5000);
      }
    }
  })();
}
