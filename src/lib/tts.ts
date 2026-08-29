import { join } from "node:path";
import { log } from "./log";

const HF_BIN = join(import.meta.dir, "..", "..", "node_modules", ".bin", "hyperframes");

export type SceneAudio = { file: string; seconds: number };

export async function synthesizeScenes(
  narrations: string[],
  assetsDir: string,
  voice = "af_heart"
): Promise<SceneAudio[]> {
  const out: SceneAudio[] = [];
  for (let i = 0; i < narrations.length; i++) {
    const file = join(assetsDir, `nar-${i}.wav`);
    const proc = Bun.spawn(
      [HF_BIN, "tts", narrations[i]!, "-o", file, "-v", voice, "--json"],
      { env: { ...process.env }, stdout: "pipe", stderr: "pipe" }
    );
    const [stdout, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    if (code !== 0) throw new Error(`tts failed for scene ${i} (exit ${code})`);
    const line = stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop();
    if (!line) throw new Error(`tts produced no JSON for scene ${i}`);
    const parsed = JSON.parse(line);
    if (!parsed.ok || !parsed.durationSeconds) throw new Error(`tts bad result for scene ${i}`);
    out.push({ file: `assets/nar-${i}.wav`, seconds: Number(parsed.durationSeconds) });
    log(`tts scene ${i}: ${parsed.durationSeconds}s`);
  }
  return out;
}
