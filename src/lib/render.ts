import { join } from "node:path";
import { log } from "./log";

const HF_BIN = join(import.meta.dir, "..", "..", "node_modules", ".bin", "hyperframes");
const RENDER_TIMEOUT_MS = 12 * 60 * 1000;

export type RenderHooks = {
  onProgress?: (done: number, total: number) => void;
  register?: (proc: ReturnType<typeof Bun.spawn>) => void;
};

async function pump(stream: ReadableStream<Uint8Array>, onLine: (line: string) => void): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let all = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    all += text;
    buf += text;
    const parts = buf.split(/\r?\n|\r/);
    buf = parts.pop() ?? "";
    for (const p of parts) onLine(p);
  }
  if (buf) onLine(buf);
  return all;
}

export async function renderComposition(jobDir: string, hooks: RenderHooks = {}): Promise<string> {
  const out = join(jobDir, "out.mp4");
  const proc = Bun.spawn(
    [HF_BIN, "render", jobDir, "-o", out, "-q", "standard"],
    { env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" }, stdout: "pipe", stderr: "pipe", cwd: jobDir }
  );
  hooks.register?.(proc);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    log(`render timeout, killing job in ${jobDir}`);
    proc.kill();
  }, RENDER_TIMEOUT_MS);
  const onLine = (line: string) => {
    const m = line.match(/Capturing frame (\d+)\/(\d+)/);
    if (m) hooks.onProgress?.(Number(m[1]), Number(m[2]));
  };
  const [stdout, stderr, code] = await Promise.all([pump(proc.stdout, onLine), pump(proc.stderr, onLine), proc.exited]);
  clearTimeout(timer);
  if (timedOut) throw new Error("render timed out");
  if (code !== 0) {
    const tail = (stderr.trim() || stdout.trim()).slice(-800);
    throw new Error(`render failed (exit ${code}): ${tail}`);
  }
  const f = Bun.file(out);
  if (!(await f.exists()) || f.size < 10000) throw new Error("render produced no output");
  log(`render complete: ${out} (${(f.size / 1e6).toFixed(1)} MB)`);
  return out;
}

export async function makePoster(jobDir: string, at = 1.6): Promise<boolean> {
  const proc = Bun.spawn(
    ["ffmpeg", "-y", "-loglevel", "error", "-ss", String(at), "-i", join(jobDir, "out.mp4"), "-frames:v", "1", "-q:v", "3", join(jobDir, "poster.jpg")],
    { env: { ...process.env }, stdout: "ignore", stderr: "pipe" }
  );
  const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) log(`poster failed: ${stderr.slice(-300)}`);
  return code === 0;
}
