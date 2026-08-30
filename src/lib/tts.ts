import { join } from "node:path";
import { log } from "./log";

const HF_BIN = join(import.meta.dir, "..", "..", "node_modules", ".bin", "hyperframes");

export type SceneAudio = { file: string; seconds: number };

function ttsErrorDetail(stdout: string, stderr: string): string {
  const line = stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop();
  if (line) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.error) return String(parsed.error).split("\n").pop()!.slice(0, 300);
    } catch {}
  }
  const meaningful = stderr
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("[SystemMemory]"))
    .join(" ");
  return (meaningful || stderr).slice(-300);
}

async function synthesizeOne(
  narration: string,
  file: string,
  voice: string,
  scene: number
): Promise<number> {
  const proc = Bun.spawn(
    [HF_BIN, "tts", narration, "-o", file, "-v", voice, "--json"],
    { env: { ...process.env }, stdout: "pipe", stderr: "pipe" }
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0)
    throw new Error(`tts failed for scene ${scene} (exit ${code}): ${ttsErrorDetail(stdout, stderr)}`);
  const line = stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop();
  if (!line) throw new Error(`tts produced no JSON for scene ${scene}`);
  const parsed = JSON.parse(line);
  if (!parsed.ok || !parsed.durationSeconds)
    throw new Error(`tts bad result for scene ${scene}: ${String(parsed.error ?? "unknown").slice(0, 300)}`);
  return Number(parsed.durationSeconds);
}

export async function synthesizeScenes(
  narrations: string[],
  assetsDir: string,
  voice = "af_heart"
): Promise<SceneAudio[]> {
  const out: SceneAudio[] = [];
  for (let i = 0; i < narrations.length; i++) {
    const file = join(assetsDir, `nar-${i}.wav`);
    let seconds: number;
    try {
      seconds = await synthesizeOne(narrations[i]!, file, voice, i);
    } catch (first) {
      log(`tts scene ${i} failed once, retrying: ${first}`);
      await Bun.sleep(2000);
      seconds = await synthesizeOne(narrations[i]!, file, voice, i);
    }
    out.push({ file: `assets/nar-${i}.wav`, seconds });
    log(`tts scene ${i}: ${seconds}s`);
  }
  return out;
}
