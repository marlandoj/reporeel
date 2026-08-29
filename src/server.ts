import { Hono } from "hono";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { pageHtml } from "./lib/ui";
import { submitJob, getJob, queuePosition, recentDone, startWorker, JOBS_DIR, DATA_DIR } from "./lib/queue";
import { log } from "./lib/log";

const app = new Hono();

function clientIp(c: any): string {
  const fwd = c.req.header("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "local";
}

app.get("/", (c) => c.html(pageHtml(null)));

app.get("/v/:id", (c) => {
  const id = c.req.param("id");
  if (!getJob(id)) return c.html(pageHtml(null), 404);
  return c.html(pageHtml(id));
});

app.post("/api/jobs", async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request." }, 400);
  }
  const url = String(body?.url ?? "").slice(0, 300);
  if (!url) return c.json({ error: "Paste a GitHub repo URL first." }, 400);
  if (process.env.RENDER_DISABLED) return c.json({ error: "Rendering is paused right now. Try again later." }, 503);
  try {
    const { id, cached } = submitJob(url, clientIp(c));
    return c.json({ id, cached });
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 429);
  }
});

app.get("/api/jobs/:id", (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) return c.json({ error: "Job not found." }, 404);
  return c.json({
    id: job.id,
    url: job.url,
    status: job.status,
    error: job.error,
    title: job.title,
    total: job.total,
    position: queuePosition(job.id),
  });
});

app.get("/api/examples", (c) => {
  const curatedPath = join(DATA_DIR, "examples.json");
  let curated: string[] = [];
  if (existsSync(curatedPath)) {
    try {
      curated = JSON.parse(readFileSync(curatedPath, "utf8"));
    } catch {}
  }
  const recent = recentDone(12).filter((j) => existsSync(join(JOBS_DIR, j.id, "out.mp4")));
  const byId = new Map(recent.map((j) => [j.id, j]));
  const ordered = [
    ...curated.map((id) => byId.get(id)).filter(Boolean),
    ...recent.filter((j) => !curated.includes(j.id)),
  ].slice(0, 9);
  return c.json(ordered.map((j: any) => ({ id: j.id, title: j.title, canonical: j.canonical })));
});

app.get("/videos/:file", async (c) => {
  const m = c.req.param("file").match(/^([\w-]+)\.mp4$/);
  if (!m) return c.text("Not found", 404);
  const path = join(JOBS_DIR, m[1]!, "out.mp4");
  const file = Bun.file(path);
  if (!(await file.exists())) return c.text("Not found", 404);
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
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }
  return new Response(file, { headers: { ...headers, "Content-Length": String(size) } });
});

app.get("/og.png", async (c) => {
  const file = Bun.file(join(import.meta.dir, "..", "public", "og.png"));
  if (!(await file.exists())) return c.text("Not found", 404);
  return new Response(file, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
});

app.get("/healthz", (c) => c.json({ ok: true }));

startWorker();
const port = Number(process.env.PORT ?? 3901);
log(`reporeel listening on :${port}`);
export default { port, fetch: app.fetch, idleTimeout: 60 };
