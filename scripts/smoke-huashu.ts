import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildHuashuComposition, renderHuashu } from "../src/lib/huashu";
import { normalizeOptions } from "../src/lib/options";
import type { VideoScript } from "../src/lib/script";

// Explicit opt-in smoke run; requires the documented renderer dependencies.
// A tone checks audio preservation without TTS downloads or a model call.
const root = mkdtempSync(join(tmpdir(), "reporeel-huashu-smoke-"));
console.log(`Artifacts: ${root}`);
for (const format of ["landscape", "vertical", "square"] as const) {
  if (process.argv[2] && process.argv[2] !== format) continue;
  const dir = join(root, format);
  mkdirSync(join(dir, "assets"), { recursive: true });
  const audio = join(dir, "assets/nar-0.wav");
  const tone = Bun.spawn(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", audio]);
  if (await tone.exited) throw new Error("Could not create smoke audio");
  const script: VideoScript = { title: "Hermes × Zouroboros", tagline: "A VPS workshop", scenes: [
    { kind: "list", heading: "Remember your work", lines: ["Store work decisions", "Search shared memory", "Resume with context"], narration: "Store decisions and resume with context." },
  ] };
  const plan = buildHuashuComposition(script, [{ file: "assets/nar-0.wav", seconds: 2 }], dir, normalizeOptions({ renderer: "huashu-keynote", format, captions: format !== "square" }));
  const start = performance.now();
  const output = await renderHuashu(dir);
  const proc = Bun.spawn(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", output], { stdout: "pipe" });
  const probe = await new Response(proc.stdout).json() as { streams: { codec_type: string; width?: number; height?: number; r_frame_rate?: string }[] };
  if (await proc.exited) throw new Error("ffprobe failed");
  const video = probe.streams.find((s: { codec_type: string }) => s.codec_type === "video");
  if (!video || video.width !== plan.width || video.height !== plan.height || video.r_frame_rate !== "30/1") throw new Error("Incorrect video dimensions/fps");
  const evidence = { format, seconds: plan.total, renderSeconds: (performance.now() - start) / 1000, probe };
  writeFileSync(join(dir, "verification.json"), JSON.stringify(evidence, null, 2));
  console.log(`${format}: ${video.width}×${video.height}, ${plan.total}s, verified`);
}
