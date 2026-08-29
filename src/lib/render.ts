import { join } from "node:path";
import { log } from "./log";

const HF_BIN = join(import.meta.dir, "..", "..", "node_modules", ".bin", "hyperframes");
const RENDER_TIMEOUT_MS = 12 * 60 * 1000;

export async function renderComposition(jobDir: string): Promise<string> {
  const out = join(jobDir, "out.mp4");
  const proc = Bun.spawn(
    [HF_BIN, "render", jobDir, "-o", out, "-q", "standard", "--quiet"],
    { env: { ...process.env }, stdout: "pipe", stderr: "pipe", cwd: jobDir }
  );
  const timer = setTimeout(() => {
    log(`render timeout, killing job in ${jobDir}`);
    proc.kill();
  }, RENDER_TIMEOUT_MS);
  const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
  clearTimeout(timer);
  if (code !== 0) {
    throw new Error(`render failed (exit ${code}): ${stderr.slice(-800)}`);
  }
  const f = Bun.file(out);
  if (!(await f.exists()) || f.size < 10000) throw new Error("render produced no output");
  log(`render complete: ${out} (${(f.size / 1e6).toFixed(1)} MB)`);
  return out;
}
