import { describe, expect, test } from "bun:test";
import { planHuashu, buildHuashuComposition } from "../src/lib/huashu";
import { normalizeOptions, parseOptions, variantKey } from "../src/lib/options";
import type { VideoScript } from "../src/lib/script";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
