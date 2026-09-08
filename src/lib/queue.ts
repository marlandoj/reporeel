import { db, ACTIVE_STATUSES, getJob, updateJob, newId, newOwnerToken, hashToken, jobDirFor, type Job } from "./db";
import { parseTarget, canonical, fetchFreshness } from "./github";
import { normalizeOptions, parseOptions, variantKey, type JobOptions } from "./options";
import { prepare, produce, CancelledError, type Stage } from "./pipeline";
import { removeDir } from "./files";
import { log } from "./log";

const RATE_LIMIT_PER_HOUR = Number(process.env.REPOREEL_RATE_LIMIT ?? 3);
const MAX_QUEUE_DEPTH = Number(process.env.REPOREEL_MAX_QUEUE ?? 6);
const ACTIVE_SQL = ACTIVE_STATUSES.map((s) => `'${s}'`).join(",");

export class SubmitError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type SubmitResult = { id: string; cached: boolean; attached: boolean; ownerToken: string | null };

export function submitJob(url: string, ip: string, rawOptions: unknown, force = false): SubmitResult {
  const target = parseTarget(url);
  if (!target) throw new SubmitError(400, "That does not look like a public GitHub repo, PR, release, or compare URL.");
  const opts = normalizeOptions(rawOptions);
  const canon = canonical(target);
  const variant = variantKey(opts);
  if (!force) {
    const done = db
      .query("SELECT id FROM jobs WHERE canonical = ? AND variant = ? AND status = 'done' ORDER BY created_at DESC LIMIT 1")
      .get(canon, variant) as { id: string } | null;
    if (done) return { id: done.id, cached: true, attached: false, ownerToken: null };
  }
  const active = db
    .query(`SELECT id FROM jobs WHERE canonical = ? AND variant = ? AND status IN (${ACTIVE_SQL}) LIMIT 1`)
    .get(canon, variant) as { id: string } | null;
  if (active) return { id: active.id, cached: false, attached: true, ownerToken: null };
  const hourAgo = Date.now() - 3600_000;
  const byIp = db.query("SELECT COUNT(*) as n FROM jobs WHERE ip = ? AND created_at > ?").get(ip, hourAgo) as { n: number };
  if (byIp.n >= RATE_LIMIT_PER_HOUR) throw new SubmitError(429, `Rate limit: ${RATE_LIMIT_PER_HOUR} new videos per hour per visitor. Try again soon.`);
  const depth = db.query(`SELECT COUNT(*) as n FROM jobs WHERE status IN (${ACTIVE_SQL})`).get() as { n: number };
  if (depth.n >= MAX_QUEUE_DEPTH) throw new SubmitError(429, "The queue is full right now. Try again in a few minutes.");
  const id = newId();
  const ownerToken = newOwnerToken();
  db.run(
    "INSERT INTO jobs (id,url,canonical,status,ip,created_at,options,variant,format,kind,owner_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    [id, url.trim(), canon, "queued", ip, Date.now(), JSON.stringify(opts), variant, opts.format, target.kind, hashToken(ownerToken)]
  );
  return { id, cached: false, attached: false, ownerToken };
}

export function queuePosition(job: Job): number {
  if (job.status !== "queued") return 0;
  const row = db
    .query(`SELECT COUNT(*) as n FROM jobs WHERE status IN (${ACTIVE_SQL}) AND id != ? AND (status != 'queued' OR created_at < ?)`)
    .get(job.id, job.created_at) as { n: number };
  return row.n;
}

export function queueDepth(): number {
  return (db.query(`SELECT COUNT(*) as n FROM jobs WHERE status IN (${ACTIVE_SQL})`).get() as { n: number }).n;
}

export function recentDone(limit = 12): Job[] {
  return db.query(`SELECT * FROM jobs WHERE status = 'done' ORDER BY COALESCE(finished_at, created_at) DESC LIMIT ?`).all(limit) as Job[];
}

export function isOwner(job: Job, token: string | undefined): boolean {
  if (!job.owner_hash || !token) return false;
  return hashToken(token) === job.owner_hash;
}

export function jobOptions(job: Job): JobOptions {
  return parseOptions(job.options);
}

export function approveJob(job: Job): void {
  if (job.status !== "review") throw new SubmitError(409, "This reel is not waiting for review.");
  updateJob(job.id, { status: "queued", phase: "render", cancel_requested: 0, stage_started_at: Date.now() });
}

export function requestCancel(job: Job): string {
  if (job.status === "queued" || job.status === "review") {
    updateJob(job.id, { status: "cancelled", cancel_requested: 1, finished_at: Date.now(), size_bytes: 0 });
    removeDir(jobDirFor(job.id));
    return "cancelled";
  }
  if (ACTIVE_STATUSES.includes(job.status)) {
    updateJob(job.id, { cancel_requested: 1 });
    if (current && current.id === job.id && current.proc) {
      try {
        current.proc.kill();
      } catch {}
    }
    return "cancelling";
  }
  return job.status;
}

export async function checkFreshness(job: Job): Promise<{ stale: boolean; pushedAt: string; latestTag: string }> {
  const target = parseTarget(job.url);
  if (!target) return { stale: false, pushedAt: "", latestTag: "" };
  const fresh = await fetchFreshness(target);
  let stale = false;
  if (target.kind === "release") {
    if (target.tag === "latest" && job.source_tag && fresh.latestTag && fresh.latestTag !== job.source_tag) stale = true;
  } else if (job.source_pushed_at && fresh.pushedAt && fresh.pushedAt !== job.source_pushed_at) {
    stale = true;
  }
  return { stale, pushedAt: fresh.pushedAt, latestTag: fresh.latestTag };
}

let current: { id: string; proc: ReturnType<typeof Bun.spawn> | null } | null = null;
let workerRunning = false;

export function currentJobId(): string | null {
  return current?.id ?? null;
}

function setStage(id: string, stage: Stage): void {
  updateJob(id, { status: stage, stage_started_at: Date.now(), progress_done: null, progress_total: null });
}

function cancelRequested(id: string): boolean {
  const row = db.query("SELECT cancel_requested FROM jobs WHERE id = ?").get(id) as { cancel_requested: number } | null;
  return Boolean(row?.cancel_requested);
}

async function workOne(): Promise<boolean> {
  const next = db.query("SELECT id, url, options, phase FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1").get() as
    | { id: string; url: string; options: string | null; phase: string | null }
    | null;
  if (!next) return false;
  const id = next.id;
  const opts = parseOptions(next.options);
  const jobDir = jobDirFor(id);
  current = { id, proc: null };
  const checkCancel = () => {
    if (cancelRequested(id)) throw new CancelledError();
  };
  try {
    if (next.phase !== "render") {
      const prep = await prepare(next.url, jobDir, opts, { onStage: (s) => setStage(id, s), checkCancel });
      updateJob(id, {
        title: prep.title,
        warnings: JSON.stringify(prep.warnings),
        source_pushed_at: prep.sourcePushedAt,
        source_tag: prep.sourceTag,
        kind: prep.target.kind,
      });
      if (opts.review) {
        checkCancel();
        updateJob(id, { status: "review", stage_started_at: Date.now() });
        log(`job ${id} waiting for review: ${prep.canonical}`);
        return true;
      }
    }
    const out = await produce(jobDir, opts, {
      onStage: (s) => setStage(id, s),
      checkCancel,
      onProgress: (done, total) => updateJob(id, { progress_done: done, progress_total: total }),
      register: (proc) => {
        if (current && current.id === id) current.proc = proc;
      },
    });
    updateJob(id, {
      status: "done",
      phase: null,
      title: out.title,
      total: out.total,
      size_bytes: out.sizeBytes,
      finished_at: Date.now(),
      progress_done: null,
      progress_total: null,
    });
    log(`job ${id} done (${opts.format}, ${(out.sizeBytes / 1e6).toFixed(1)} MB on disk)`);
  } catch (e: any) {
    if (e instanceof CancelledError || cancelRequested(id)) {
      removeDir(jobDir);
      updateJob(id, { status: "cancelled", phase: null, finished_at: Date.now(), size_bytes: 0, progress_done: null, progress_total: null });
      log(`job ${id} cancelled`);
    } else {
      updateJob(id, { status: "error", phase: null, error: String(e?.message ?? e).slice(0, 400), finished_at: Date.now(), progress_done: null, progress_total: null });
      log(`job ${id} failed: ${e}`);
    }
  } finally {
    current = null;
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

export { getJob };
