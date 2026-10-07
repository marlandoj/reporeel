import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { VideoScript } from "./script";
import type { SceneAudio } from "./tts";
import { FORMATS, type JobOptions } from "./options";
import { buildCaptions, toSrt } from "./captions";
import type { RenderHooks } from "./render";

export function checkHuashu(): string {
  const root = process.env.HUASHU_ROOT;
  if (!root || !existsSync(join(root, "scripts/engine/render.py")))
    throw new Error("Huashu Keynote requires HUASHU_ROOT pointing to a huashu-art-motion checkout; see docs/huashu.md.");
  return resolve(root);
}

/** Frame-aligned scene boundaries keep concatenation and narration in sync. */
export function planHuashu(script: VideoScript, audio: SceneAudio[], opts: JobOptions) {
  if (!audio.length || script.scenes.length !== audio.length) throw new Error("Each scene needs narration audio");
  const { w, h } = FORMATS[opts.format];
  const fps = 30;
  let frame = 0;
  const scenes = script.scenes.map((s, i) => {
    const a = audio[i]!;
    if (!Number.isFinite(a.seconds) || a.seconds <= 0) throw new Error("Invalid narration duration");
    const cardCount = s.kind === "stats" ? s.stats?.length ?? 0 : s.lines?.length ?? 0;
    const frames = Math.ceil(Math.max(cardCount > 3 ? 5.2 : 3.2, a.seconds + 1.3) * fps);
    const start = frame / fps;
    frame += frames;
    // One card per cue avoids silently dropping the fourth statistic. Preserve
    // abbreviated values as text: parsing '12.4k' as a number would change facts.
    const cards = s.kind === "stats"
      ? (s.stats ?? []).map(v => ({ text: v.value, sub: v.label }))
      : (s.lines ?? []).map(text => ({ text, sub: "" }));
    const title = s.kind === "title" ? (s.lines?.[0] || script.title) : s.heading;
    const titleOnly = s.kind === "title" || s.kind === "outro";
    const cues: Record<string, unknown>[] = [{ at: 0, kind: "title" }];
    if (!titleOnly) cards.forEach((card, k) => cues.push({
      at: 0.7 + Math.floor(k / 3) * (frames / fps / Math.ceil(cards.length / 3)) + (k % 3) * 0.45,
      kind: "card", ...card, data: { icon: s.kind === "code" ? "code" : "layers" },
    }));
    return { start, audio: a.file, audioSeconds: a.seconds, frames, spec: {
      grammar: "t2_keynote_ui", duration: frames / fps, fps, width: w, height: h,
      safe: { top: Math.round(h * 0.04), bottom: opts.captions ? Math.round(h * 0.23) : Math.round(h * 0.06), left: 24, right: 24 },
      data: { eyebrow: "REPOREEL", title, subtitle: titleOnly ? (s.lines ?? []).slice(s.kind === "title" ? 1 : 0).join(" · ") : "", accent: "#22d3ee" }, cues,
    } };
  });
  const captions = opts.captions ? buildCaptions(script.scenes.map(s => s.narration), scenes.map(s => s.start + 0.4), audio.map(a => a.seconds), opts.format === "vertical" ? 34 : 52) : [];
  return { scenes, total: frame / fps, captions, width: w, height: h, fps };
}

export function buildHuashuComposition(script: VideoScript, audio: SceneAudio[], jobDir: string, opts: JobOptions) {
  const plan = planHuashu(script, audio, opts);
  mkdirSync(join(jobDir, "huashu"), { recursive: true });
  writeFileSync(join(jobDir, "huashu/plan.json"), JSON.stringify(plan, null, 2));
  if (opts.captions) writeFileSync(join(jobDir, "out.srt"), toSrt(plan.captions));
  return plan;
}

export async function renderHuashu(jobDir: string, hooks: RenderHooks & { checkCancel?: () => void } = {}): Promise<string> {
  const root = checkHuashu();
  hooks.checkCancel?.();
  const proc = Bun.spawn([process.env.HUASHU_PYTHON || "python3", join(import.meta.dir, "../../scripts/render-huashu.py"), resolve(jobDir), root], { stdout: "pipe", stderr: "pipe" });
  hooks.register?.(proc);
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; proc.kill(); }, 12 * 60 * 1000);
  const read = async () => {
    let buffer = "";
    for await (const chunk of proc.stdout) {
      buffer += new TextDecoder().decode(chunk);
      const lines = buffer.split("\n"); buffer = lines.pop() || "";
      for (const line of lines) {
        const m = line.match(/^REPOREEL_PROGRESS (\d+) (\d+)$/);
        if (m) hooks.onProgress?.(+m[1]!, +m[2]!);
      }
    }
  };
  try {
    const [, error, code] = await Promise.all([read(), new Response(proc.stderr).text(), proc.exited]);
    hooks.checkCancel?.();
    if (timedOut) throw new Error("Huashu render timed out");
    if (code !== 0) throw new Error(`Huashu render failed (exit ${code}): ${error.slice(-800)}`);
    const out = join(jobDir, "out.mp4");
    if (!(await Bun.file(out).exists()) || Bun.file(out).size < 1000) throw new Error("Huashu produced no output");
    return out;
  } finally { clearTimeout(timer); }
}
