import { describe, expect, test } from "bun:test";
import { planHuashu, buildHuashuComposition, checkHuashu, findPlaywrightBrowser, playwrightBrowsersPath, summarizeRenderError } from "../src/lib/huashu";
import { normalizeOptions, parseOptions, variantKey } from "../src/lib/options";
import type { VideoScript } from "../src/lib/script";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const script: VideoScript = { title: "Hermes × Zouroboros", tagline: "A persistent workshop", scenes: [
  { kind: "title", heading: "Welcome", lines: ["Hermes × Zouroboros", "Your VPS workshop"], narration: "A persistent workshop for your Linux VPS." },
  { kind: "stats", heading: "Facts", stats: [{ value: "12.4k", label: "stars" }, { value: "9", label: "packages" }, { value: "3", label: "commands" }, { value: "0.1.0", label: "version" }], narration: "Keep the source facts intact." },
  { kind: "code", heading: "Start", lines: ['bun integration/cli.ts doctor', 'echo "ready"'], narration: "Check your installation." },
] };
const audio = script.scenes.map((_, i) => ({ file: `assets/nar-${i}.wav`, seconds: 2.137 + i }));

describe("Huashu adapter", () => {
  test("default and legacy cache keys remain compatible; Huashu is isolated", () => {
    const base = normalizeOptions({});
    expect(base.renderer).toBe("hyperframes");
    expect(variantKey(base)).toBe("landscape:studio:both:std:nocc");
    expect(variantKey(normalizeOptions({ renderer: "huashu-keynote" }))).not.toBe(variantKey(base));
    expect(parseOptions('{"renderer":"huashu-keynote","style":"3b1b"}').style).toBe("studio");
    expect(normalizeOptions({ renderer: "../../evil" }).renderer).toBe("hyperframes");
  });
  for (const format of ["landscape", "vertical", "square"] as const) {
    test(`${format}: narration fits frame-aligned scenes and safe caption band`, () => {
      const p = planHuashu(script, audio, normalizeOptions({ format, captions: true }));
      p.scenes.forEach((s, i) => {
        expect(s.start * 30).toBeCloseTo(Math.round(s.start * 30));
        expect(s.spec.duration).toBeGreaterThanOrEqual(audio[i]!.seconds + 1.3);
        expect(s.spec.safe.bottom).toBeGreaterThan(p.height * 0.2);
        expect(s.spec.cues.every(c => Number(c.at) < s.spec.duration)).toBe(true);
        const caps = p.captions.filter(c => c.scene === i);
        expect(caps[0]!.start).toBeCloseTo(s.start + 0.4, 1);
        expect(caps.at(-1)!.end).toBeLessThan(s.start + s.spec.duration);
      });
      expect(p.total).toBeCloseTo(p.scenes.reduce((n, s) => n + s.spec.duration, 0));
      expect(p.scenes[1]!.spec.cues.map(c => c.text).filter(Boolean)).toEqual(["12.4k", "9", "3", "0.1.0"]);
      expect(p.scenes[2]!.spec.cues[2]!.text).toBe('echo "ready"');
    });
  }
  test("missing and invalid audio fails before rendering", () => {
    expect(() => planHuashu(script, [], normalizeOptions({}))).toThrow();
    expect(() => planHuashu(script, audio.map(a => ({ ...a, seconds: NaN })), normalizeOptions({}))).toThrow();
  });
  test("browser probe: finds an installed headless shell, rejects an empty cache", () => {
    const dir = mkdtempSync(join(tmpdir(), "huashu-browsers-"));
    try {
      expect(findPlaywrightBrowser(dir)).toBeNull();
      const shell = join(dir, "chromium_headless_shell-1243", "chrome-headless-shell-linux64", "chrome-headless-shell");
      mkdirSync(dirname(shell), { recursive: true });
      writeFileSync(shell, "");
      if (process.platform !== "win32") chmodSync(shell, 0o755);
      expect(findPlaywrightBrowser(dir)).toBe(shell);
      // A directory without an executable is not a browser.
      const empty = join(dir, "chromium-9999");
      mkdirSync(empty, { recursive: true });
      expect(findPlaywrightBrowser(join(dir, "chromium-9999/.."))).toBe(shell);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  test("browser probe: a shell for the wrong Playwright revision does not count", () => {
    const dir = mkdtempSync(join(tmpdir(), "huashu-browsers-rev-"));
    const venv = mkdtempSync(join(tmpdir(), "huashu-venv-"));
    try {
      const shell = join(dir, "chromium_headless_shell-1111", "chrome-headless-shell-linux64", "chrome-headless-shell");
      mkdirSync(dirname(shell), { recursive: true });
      writeFileSync(shell, "");
      if (process.platform !== "win32") chmodSync(shell, 0o755);
      const pkg = join(venv, "lib", "python3.14", "site-packages", "playwright", "driver", "package");
      mkdirSync(pkg, { recursive: true });
      writeFileSync(join(pkg, "browsers.json"), JSON.stringify({ browsers: [
        { name: "chromium", revision: "2222" }, { name: "chromium-headless-shell", revision: "2222" },
      ] }));
      const python = join(venv, "bin", "python");
      // Without revision knowledge the shell counts; with it, it must not.
      expect(findPlaywrightBrowser(dir)).toBe(shell);
      expect(findPlaywrightBrowser(dir, python)).toBeNull();
    } finally { rmSync(dir, { recursive: true, force: true }); rmSync(venv, { recursive: true, force: true }); }
  });
  test("checkHuashu fails closed when the browser is missing, passes when present", () => {
    const root = mkdtempSync(join(tmpdir(), "huashu-root-"));
    const browsers = mkdtempSync(join(tmpdir(), "huashu-check-browsers-"));
    const saved = { root: process.env.HUASHU_ROOT, browsers: process.env.PLAYWRIGHT_BROWSERS_PATH, python: process.env.HUASHU_PYTHON };
    try {
      mkdirSync(join(root, "scripts/engine"), { recursive: true });
      writeFileSync(join(root, "scripts/engine/render.py"), "");
      process.env.HUASHU_ROOT = root;
      process.env.PLAYWRIGHT_BROWSERS_PATH = browsers;
      delete process.env.HUASHU_PYTHON;
      expect(() => checkHuashu()).toThrow(/Playwright Chromium browser/);
      const shell = join(browsers, "chromium_headless_shell-1243", "chrome-headless-shell-linux64", "chrome-headless-shell");
      mkdirSync(dirname(shell), { recursive: true });
      writeFileSync(shell, "");
      if (process.platform !== "win32") chmodSync(shell, 0o755);
      expect(checkHuashu()).toBe(root);
    } finally {
      rmSync(root, { recursive: true, force: true }); rmSync(browsers, { recursive: true, force: true });
      if (saved.root === undefined) delete process.env.HUASHU_ROOT; else process.env.HUASHU_ROOT = saved.root;
      if (saved.browsers === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH; else process.env.PLAYWRIGHT_BROWSERS_PATH = saved.browsers;
      if (saved.python === undefined) delete process.env.HUASHU_PYTHON; else process.env.HUASHU_PYTHON = saved.python;
    }
  });
  test("browsers path honors PLAYWRIGHT_BROWSERS_PATH first", () => {
    expect(playwrightBrowsersPath({ PLAYWRIGHT_BROWSERS_PATH: "/tmp/custom-browsers" })).toBe("/tmp/custom-browsers");
  });
  test("render errors keep the root cause at the head and the wrapper at the tail", () => {
    expect(summarizeRenderError("short error")).toBe("short error");
    const cause = "ROOT_CAUSE: Executable doesn't exist at /cache/chrome-headless-shell";
    const long = `${cause}\n${"engine frame progress\n".repeat(400)}WRAPPER_TRACEBACK_END`;
    const out = summarizeRenderError(long);
    expect(out.length).toBeLessThanOrEqual(3100);
    expect(out).toContain(cause);
    expect(out).toContain("WRAPPER_TRACEBACK_END");
    expect(out).toContain("[truncated]");
  });
  test("caption option controls both timeline and sidecar", () => {
    const dir = mkdtempSync(join(tmpdir(), "huashu-test-"));
    try {
      expect(planHuashu(script, audio, normalizeOptions({ captions: false })).captions).toEqual([]);
      const p = buildHuashuComposition(script, audio, dir, normalizeOptions({ captions: true }));
      expect(JSON.parse(readFileSync(join(dir, "huashu/plan.json"), "utf8")).total).toBe(p.total);
      expect(readFileSync(join(dir, "out.srt"), "utf8")).toContain("00:00:00,400");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
