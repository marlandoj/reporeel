import { assertGenerationEnabled, watchGenerationProcess, ControlError } from "./controls";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import type { VideoScript } from "./script";
import type { SceneAudio } from "./tts";
import { FORMATS, type JobOptions } from "./options";
import { buildCaptions, toSrt } from "./captions";
import type { RenderHooks } from "./render";

export function huashuAvailable(): boolean {
  try { checkHuashu(); return true; } catch { return false; }
}

export function checkHuashu(): string {
  const root = process.env.HUASHU_ROOT;
  if (!root || !existsSync(join(root, "scripts/engine/render.py")))
    throw new Error("Huashu Keynote requires HUASHU_ROOT pointing to a huashu-art-motion checkout; see docs/huashu.md.");
  // The checkout alone is not capability: the engine launches Playwright's
  // Chromium, and a wiped browser cache left Keynote selectable but broken
  // (2026-10-26: /healthz reported huashu:true with no browser installed).
  if (!findPlaywrightBrowser(playwrightBrowsersPath(), process.env.HUASHU_PYTHON || "python3"))
    throw new Error("Huashu Keynote requires the Playwright Chromium browser for HUASHU_PYTHON; install it during provisioning with: \"$HUASHU_PYTHON\" -m playwright install chromium (see docs/huashu.md).");
  return resolve(root);
}

/** Playwright's browser cache directory for this host, in its own resolution order. */
export function playwrightBrowsersPath(env: Record<string, string | undefined> = process.env): string {
  if (env.PLAYWRIGHT_BROWSERS_PATH) return env.PLAYWRIGHT_BROWSERS_PATH;
  if (process.platform === "darwin") return join(homedir(), "Library", "Caches", "ms-playwright");
  if (process.platform === "win32") return join(env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "ms-playwright");
  return join(env.XDG_CACHE_HOME || join(homedir(), ".cache"), "ms-playwright");
}

/** Chromium revisions the venv's Playwright expects, from its browsers.json; null when unreadable. */
function expectedChromiumRevisions(python: string): Set<string> | null {
  try {
    const venv = resolve(dirname(python), "..");
    const sitePackages: string[] = [join(venv, "lib", "site-packages"), join(venv, "Lib", "site-packages")];
    try {
      for (const entry of readdirSync(join(venv, "lib"), { withFileTypes: true }))
        if (entry.isDirectory()) sitePackages.push(join(venv, "lib", entry.name, "site-packages"));
    } catch { /* layout differs; the fixed candidates above still apply */ }
    for (const pkg of sitePackages) {
      const file = join(pkg, "playwright", "driver", "package", "browsers.json");
      if (!existsSync(file)) continue;
      const data = JSON.parse(readFileSync(file, "utf8"));
      const revs = new Set<string>((data.browsers ?? [])
        .filter((b: any) => b.name === "chromium" || b.name === "chromium-headless-shell")
        .map((b: any) => String(b.revision)));
      if (revs.size) return revs;
    }
  } catch { /* probe falls back to any installed Chromium */ }
  return null;
}

const BROWSER_EXECUTABLES = new Set(["chrome-headless-shell", "chrome", "chrome.exe", "Chromium", "headless_shell"]);

function findBrowserExecutable(dir: string, depth: number): string | null {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isFile() && BROWSER_EXECUTABLES.has(entry.name)) {
      try { if (process.platform === "win32" || (statSync(path).mode & 0o111)) return path; } catch { /* keep looking */ }
    } else if (entry.isDirectory() && depth > 0) {
      const found = findBrowserExecutable(path, depth - 1);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Locate a usable Chromium (full build or headless shell) in Playwright's
 * browser cache. When the venv's browsers.json is readable, only the
 * revisions it expects count — a stale shell for another Playwright
 * version would fail at launch just the same.
 */
export function findPlaywrightBrowser(browsersPath: string, python?: string): string | null {
  if (!browsersPath || !existsSync(browsersPath)) return null;
  const revisions = python ? expectedChromiumRevisions(python) : null;
  let entries;
  try { entries = readdirSync(browsersPath, { withFileTypes: true }); } catch { return null; }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("chromium")) continue;
    if (revisions) {
      const rev = entry.name.match(/-(\d+)$/)?.[1];
      if (!rev || !revisions.has(rev)) continue;
    }
    const found = findBrowserExecutable(join(browsersPath, entry.name), 3);
    if (found) return found;
  }
  return null;
}

/**
 * Keep a renderer failure diagnosable: head + tail, bounded. The engine's
 * own traceback (with the root cause) sits at the START of stderr and the
 * wrapper's at the end; keeping only a short tail — the old slice(-800) —
 * discarded the cause entirely.
 */
export function summarizeRenderError(stderr: string, max = 3000): string {
  const text = stderr.trim();
  if (text.length <= max) return text;
  const head = Math.floor(max * 0.6), tail = max - head;
  return `${text.slice(0, head)}\n…[truncated]…\n${text.slice(-tail)}`;
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
  assertGenerationEnabled();
  const proc = Bun.spawn([process.env.HUASHU_PYTHON || "python3", join(import.meta.dir, "../../scripts/render-huashu.py"), resolve(jobDir), root], { stdout: "pipe", stderr: "pipe" });
  hooks.register?.(proc);
  const unwatch = watchGenerationProcess(proc);
  let timedOut = false;
  const renderTimeoutMs = Math.max(5, Number(process.env.HUASHU_RENDER_TIMEOUT_MIN ?? 30)) * 60 * 1000;
  const timer = setTimeout(() => { timedOut = true; proc.kill(); }, renderTimeoutMs);
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
    assertGenerationEnabled();
    hooks.checkCancel?.();
    if (timedOut) throw new Error("Huashu render timed out");
    if (code !== 0) throw new Error(`Huashu render failed (exit ${code}): ${summarizeRenderError(error)}`);
    const out = join(jobDir, "out.mp4");
    if (!(await Bun.file(out).exists()) || Bun.file(out).size < 1000) throw new Error("Huashu produced no output");
    return out;
  } finally { clearTimeout(timer); unwatch(); }
}
