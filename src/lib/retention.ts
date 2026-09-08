import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { db, DATA_DIR, JOBS_DIR, jobDirFor, listJobs, updateJob } from "./db";
import { dirSize, removeDir } from "./files";
import { log } from "./log";

const DAY = 86_400_000;
const RETENTION_DAYS = Number(process.env.REPOREEL_RETENTION_DAYS ?? 30);
const MAX_STORAGE_MB = Number(process.env.REPOREEL_MAX_STORAGE_MB ?? 1500);
const REVIEW_TTL_HOURS = Number(process.env.REPOREEL_REVIEW_TTL_HOURS ?? 24);
const FAILED_TTL_HOURS = 24;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export type SweepReport = {
  expired: number;
  purgedFailed: number;
  evicted: number;
  reviewsExpired: number;
  missing: number;
  bytesAfter: number;
};

function curatedIds(): string[] {
  const p = join(DATA_DIR, "examples.json");
  if (!existsSync(p)) return [];
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8"));
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function expireJob(id: string, status: "expired" | "cancelled" = "expired"): void {
  removeDir(jobDirFor(id));
  updateJob(id, { status, size_bytes: 0, finished_at: Date.now() });
}

export function storageStats(): { jobs: number; bytes: number } {
  const row = db.query("SELECT COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS b FROM jobs WHERE status = 'done'").get() as { n: number; b: number };
  return { jobs: row.n, bytes: row.b };
}

export function sweep(): SweepReport {
  const now = Date.now();
  const report: SweepReport = { expired: 0, purgedFailed: 0, evicted: 0, reviewsExpired: 0, missing: 0, bytesAfter: 0 };

  for (const id of curatedIds()) updateJob(id, { pinned: 1 });

  for (const job of listJobs("status = 'done'")) {
    const mp4 = join(jobDirFor(job.id), "out.mp4");
    if (!existsSync(mp4)) {
      expireJob(job.id);
      report.missing++;
      continue;
    }
    if (job.size_bytes === null) updateJob(job.id, { size_bytes: dirSize(jobDirFor(job.id)) });
  }

  for (const job of listJobs("status IN ('error','cancelled') AND created_at < ?", [now - FAILED_TTL_HOURS * 3_600_000])) {
    removeDir(jobDirFor(job.id));
    updateJob(job.id, { size_bytes: 0 });
    report.purgedFailed++;
  }

  for (const job of listJobs("status = 'review' AND COALESCE(stage_started_at, created_at) < ?", [now - REVIEW_TTL_HOURS * 3_600_000])) {
    expireJob(job.id);
    report.reviewsExpired++;
  }

  for (const job of listJobs("status = 'done' AND pinned = 0 AND COALESCE(finished_at, created_at) < ?", [now - RETENTION_DAYS * DAY])) {
    expireJob(job.id);
    report.expired++;
  }

  const cap = MAX_STORAGE_MB * 1_000_000;
  let { bytes } = storageStats();
  if (bytes > cap) {
    for (const job of listJobs("status = 'done' AND pinned = 0 ORDER BY views ASC, COALESCE(finished_at, created_at) ASC")) {
      if (bytes <= cap) break;
      bytes -= job.size_bytes ?? 0;
      expireJob(job.id);
      report.evicted++;
    }
  }

  report.bytesAfter = storageStats().bytes;
  const touched = report.expired + report.purgedFailed + report.evicted + report.reviewsExpired + report.missing;
  if (touched > 0) log(`retention sweep: ${JSON.stringify(report)}`);
  return report;
}

export function startRetention(): void {
  setTimeout(() => {
    try {
      sweep();
    } catch (e) {
      log(`retention sweep failed: ${e}`);
    }
  }, 30_000);
  setInterval(() => {
    try {
      sweep();
    } catch (e) {
      log(`retention sweep failed: ${e}`);
    }
  }, SWEEP_INTERVAL_MS);
}

export { JOBS_DIR };
