import { Hono } from "hono";
import type { Context } from "hono";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pageHtml } from "./lib/ui";
import { DATA_DIR, JOBS_DIR, getJob, updateJob, jobDirFor, type Job } from "./lib/db";
import {
  submitJob, queuePosition, queueDepth, recentDone, startWorker, isOwner, jobOptions,
  approveJob, requestCancel, checkFreshness, currentJobId, SubmitError,
} from "./lib/queue";
import { reviewState, saveScript, rewriteScene } from "./lib/review";
import { startRetention, storageStats } from "./lib/retention";
import { FORMATS } from "./lib/options";
import { log } from "./lib/log";

const app = new Hono();

function clientIp(c: Context): string {
  const fwd = c.req.header("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return "local";
}

function errorResponse(c: Context, e: unknown) {
  if (e instanceof SubmitError) return c.json({ error: e.message }, e.status as 400);
  const msg = e instanceof Error ? e.message : String(e);
  log(`request failed: ${msg}`);
  return c.json({ error: msg.slice(0, 300) }, 500);
}

function hasPoster(id: string): boolean {
  return existsSync(join(jobDirFor(id), "poster.jpg"));
}

function hasSrt(id: string): boolean {
  return existsSync(join(jobDirFor(id), "out.srt"));
}

function progressInfo(job: Job): { done: number; total: number; etaSeconds: number | null } | null {
  if (job.status !== "rendering") return null;
  const done = job.progress_done ?? 0;
  const total = job.progress_total ?? 0;
  if (!total) return { done: 0, total: 0, etaSeconds: null };
  const elapsed = (Date.now() - (job.stage_started_at ?? Date.now())) / 1000;
  const etaSeconds = done > 0 ? Math.max(0, Math.round((elapsed / done) * (total - done)) + 8) : null;
  return { done, total, etaSeconds };
}

function jobView(job: Job, owner: boolean) {
  const opts = jobOptions(job);
  const spec = FORMATS[opts.format];
  let warnings: string[] = [];
  try {
    warnings = job.warnings ? JSON.parse(job.warnings) : [];
  } catch {}
  return {
    id: job.id,
    url: job.url,
    canonical: job.canonical,
    kind: job.kind,
    status: job.status,
    error: job.error,
    title: job.title,
    total: job.total,
    options: opts,
    format: { key: opts.format, ratio: spec.ratio, label: spec.label, w: spec.w, h: spec.h },
    captions: opts.captions && (job.status === "done" ? hasSrt(job.id) : true),
    position: queuePosition(job),
    progress: progressInfo(job),
    warnings,
    views: job.views,
    poster: job.status === "done" && hasPoster(job.id),
    sourcePushedAt: job.source_pushed_at,
    owner,
    cancellable: owner && ["queued", "ingesting", "scripting", "review", "voicing", "rendering"].includes(job.status),
    createdAt: job.created_at,
    finishedAt: job.finished_at,
  };
}

const viewDedup = new Set<string>();
let viewDedupReset = Date.now();

function recordView(job: Job, ip: string): void {
  if (job.status !== "done") return;
  if (Date.now() - viewDedupReset > 3_600_000 || viewDedup.size > 50_000) {
    viewDedup.clear();
    viewDedupReset = Date.now();
  }
  const key = createHash("sha256").update(`${job.id}:${ip}:${Math.floor(Date.now() / 3_600_000)}`).digest("hex").slice(0, 24);
  if (viewDedup.has(key)) return;
  viewDedup.add(key);
  updateJob(job.id, { views: job.views + 1 });
}

function ownerFromRequest(c: Context, job: Job): boolean {
  return isOwner(job, c.req.header("x-owner-token"));
}

app.get("/", (c) => c.html(pageHtml(null)));

app.get("/v/:id", (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) return c.html(pageHtml(null), 404);
  recordView(job, clientIp(c));
  return c.html(pageHtml({ job, poster: hasPoster(job.id) }));
});

app.post("/api/jobs", async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request." }, 400);
  }
  const url = String(body?.url ?? "").slice(0, 300);
  if (!url) return c.json({ error: "Paste a GitHub URL first." }, 400);
  if (process.env.RENDER_DISABLED) return c.json({ error: "Rendering is paused right now. Try again later." }, 503);
  try {
    const result = submitJob(url, clientIp(c), body?.options, body?.force === true);
    return c.json(result);
  } catch (e) {
    return errorResponse(c, e);
  }
});

app.get("/api/jobs/:id", (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) return c.json({ error: "Job not found." }, 404);
  return c.json(jobView(job, ownerFromRequest(c, job)));
});

app.get("/api/jobs/:id/script", (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) return c.json({ error: "Job not found." }, 404);
  if (!ownerFromRequest(c, job)) return c.json({ error: "Only the person who started this reel can edit its script." }, 403);
  try {
    return c.json(reviewState(job));
  } catch (e) {
    return errorResponse(c, e);
  }
});

app.put("/api/jobs/:id/script", async (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) return c.json({ error: "Job not found." }, 404);
  if (!ownerFromRequest(c, job)) return c.json({ error: "Only the person who started this reel can edit its script." }, 403);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request." }, 400);
  }
  try {
    return c.json(saveScript(job, body));
  } catch (e) {
    if (e instanceof SubmitError) return errorResponse(c, e);
    return c.json({ error: `Script rejected: ${e instanceof Error ? e.message : String(e)}` }, 400);
  }
});

app.post("/api/jobs/:id/scenes/:index/regenerate", async (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) return c.json({ error: "Job not found." }, 404);
  if (!ownerFromRequest(c, job)) return c.json({ error: "Only the person who started this reel can edit its script." }, 403);
  let hint = "";
  try {
    const body: any = await c.req.json();
    hint = String(body?.hint ?? "").slice(0, 300);
  } catch {}
  try {
    return c.json(await rewriteScene(job, Number(c.req.param("index")), hint));
  } catch (e) {
    return errorResponse(c, e);
  }
});

app.post("/api/jobs/:id/render", (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) return c.json({ error: "Job not found." }, 404);
  if (!ownerFromRequest(c, job)) return c.json({ error: "Only the person who started this reel can render it." }, 403);
  if (process.env.RENDER_DISABLED) return c.json({ error: "Rendering is paused right now. Try again later." }, 503);
  try {
    approveJob(job);
    return c.json({ ok: true, status: "queued" });
  } catch (e) {
    return errorResponse(c, e);
  }
});

app.post("/api/jobs/:id/cancel", (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) return c.json({ error: "Job not found." }, 404);
  if (!ownerFromRequest(c, job)) return c.json({ error: "Only the person who started this reel can cancel it." }, 403);
  return c.json({ ok: true, status: requestCancel(job) });
});

app.post("/api/jobs/:id/refresh", async (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) return c.json({ error: "Job not found." }, 404);
  let force = false;
  try {
    const body: any = await c.req.json();
    force = body?.force === true;
  } catch {}
  try {
    const fresh = await checkFreshness(job);
    if (!fresh.stale && !force) return c.json({ stale: false, pushedAt: fresh.pushedAt, latestTag: fresh.latestTag });
    if (!force) return c.json({ stale: true, pushedAt: fresh.pushedAt, latestTag: fresh.latestTag });
    const result = submitJob(job.url, clientIp(c), jobOptions(job), true);
    return c.json({ stale: fresh.stale, pushedAt: fresh.pushedAt, latestTag: fresh.latestTag, ...result });
  } catch (e) {
    return errorResponse(c, e);
  }
});

app.get("/api/examples", (c) => {
  const curatedPath = join(DATA_DIR, "examples.json");
  let curated: string[] = [];
  if (existsSync(curatedPath)) {
    try {
      curated = JSON.parse(readFileSync(curatedPath, "utf8"));
    } catch {}
  }
  const recent = recentDone(18).filter((j) => existsSync(join(JOBS_DIR, j.id, "out.mp4")));
  const byId = new Map(recent.map((j) => [j.id, j]));
  const ordered = [
    ...curated.map((id) => byId.get(id)).filter((j): j is Job => Boolean(j)),
    ...recent.filter((j) => !curated.includes(j.id)),
  ].slice(0, 12);
  return c.json(
    ordered.map((j) => ({
      id: j.id,
      title: j.title,
      canonical: j.canonical,
      format: jobOptions(j).format,
      poster: hasPoster(j.id),
      views: j.views,
    }))
  );
});

function serveVideo(c: Context, path: string) {
  const file = Bun.file(path);
  const size = file.size;
  const range = c.req.header("range");
  const headers: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  if (range) {
    const rm = range.match(/bytes=(\d*)-(\d*)/);
    const start = rm?.[1] ? Number(rm[1]) : 0;
    const end = rm?.[2] ? Math.min(Number(rm[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    return new Response(file.slice(start, end + 1), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(file, { headers: { ...headers, "Content-Length": String(size) } });
}

app.get("/videos/:file", async (c) => {
  const m = c.req.param("file").match(/^([\w-]+)\.(mp4|srt)$/);
  if (!m) return c.text("Not found", 404);
  const id = m[1]!;
  if (m[2] === "srt") {
    const srt = Bun.file(join(JOBS_DIR, id, "out.srt"));
    if (!(await srt.exists())) return c.text("Not found", 404);
    const job = getJob(id);
    const name = (job?.title ?? id).replace(/[^\w.-]+/g, "-").slice(0, 60) || id;
    return new Response(srt, {
      headers: {
        "Content-Type": "application/x-subrip; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.srt"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }
  const path = join(JOBS_DIR, id, "out.mp4");
  if (!(await Bun.file(path).exists())) return c.text("Not found", 404);
  return serveVideo(c, path);
});

app.get("/posters/:file", async (c) => {
  const m = c.req.param("file").match(/^([\w-]+)\.jpg$/);
  if (!m) return c.text("Not found", 404);
  const file = Bun.file(join(JOBS_DIR, m[1]!, "poster.jpg"));
  if (!(await file.exists())) return c.text("Not found", 404);
  return new Response(file, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" } });
});

app.get("/og.png", async (c) => {
  const file = Bun.file(join(import.meta.dir, "..", "public", "og.png"));
  if (!(await file.exists())) return c.text("Not found", 404);
  return new Response(file, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
});

app.get("/healthz", (c) => {
  const storage = storageStats();
  return c.json({ ok: true, queue: queueDepth(), working: currentJobId(), reels: storage.jobs, storageMb: Math.round(storage.bytes / 1e5) / 10 });
});

startWorker();
startRetention();
const port = Number(process.env.PORT ?? 3901);
log(`reporeel listening on :${port} (data: ${DATA_DIR})`);
export default { port, fetch: app.fetch, idleTimeout: 60 };
