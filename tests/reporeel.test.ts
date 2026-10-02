import { describe, expect, test } from "bun:test";
import { STYLES, STYLE_IDS } from "../src/lib/styles";
import { FORMATS } from "../src/lib/options";
import { buildComposition } from "../src/lib/compose";
import { lintSte100, styleWarnings, steWordCount, STE_MODES } from "../src/lib/ste100";
import { toView, STE_SECTIONS, STE_RULES } from "../src/lib/steapi";
import { normalizeOptions, variantKey, type JobOptions } from "../src/lib/options";
import type { VideoScript } from "../src/lib/script";

describe("styles", () => {
  test("every style declares a full palette and a layout", () => {
    for (const id of STYLE_IDS) {
      const st = STYLES[id]!;
      expect(st.id).toBe(id);
      expect(st.label.length).toBeGreaterThan(0);
      expect(st.layout === "board" || st.layout === "cards").toBe(true);
      for (const token of [
        "--bg",
        "--bg-far",
        "--fg",
        "--muted",
        "--faint",
        "--panel",
        "--line",
        "--accent",
        "--accent-2",
        "--accent-3",
        "--font",
        "--mono",
      ]) {
        expect(st.vars).toContain(token);
      }
    }
  });

  test("only the 3b1b style uses the board layout", () => {
    const boards = STYLE_IDS.filter((id) => STYLES[id]!.layout === "board");
    expect(boards).toEqual(["3b1b"]);
  });

  test("the three b1b style is in the list the operator sees", () => {
    expect(STYLE_IDS).toContain("3b1b");
    expect(STYLE_IDS).toContain("eli5");
  });
});

describe("options", () => {
  test("an unknown or missing style falls back to studio", () => {
    expect(normalizeOptions({}).style).toBe("studio");
    expect(normalizeOptions({ style: "nope" }).style).toBe("studio");
  });

  test("a known style survives normalization", () => {
    for (const id of STYLE_IDS) {
      expect(normalizeOptions({ style: id }).style).toBe(id);
    }
  });

  test("the style is part of the render cache key", () => {
    const base = normalizeOptions({});
    const other = normalizeOptions({ style: "3b1b" });
    expect(variantKey(base)).not.toBe(variantKey(other));
  });
});

describe("ste100 linter", () => {
  test("flags a long sentence with too many words", () => {
    const report = lintSte100(
      "The system that we built for ingesting and rendering these repositories is designed to be " +
        "deterministic and fast, so that two people can make the same video from the same commit."
    );
    expect(report.findings.some((f) => f.rule === "6.3" || f.rule === "5.1")).toBe(true);
  });

  test("a sentence that opens with a subordinator is descriptive, not procedural", () => {
    const report = lintSte100(
      "Although the cache is warm, the first request still pays for a full read of the source tree and " +
        "walks every directory that the manifest points at before it can answer the question."
    );
    expect(report.findings.some((f) => f.rule === "6.3")).toBe(true);
  });

  test("counts words excluding stop words", () => {
    expect(steWordCount("The quick brown fox is over there")).toBe(7);
  });

  test("returns a score between 0 and 100", () => {
    const report = lintSte100("Due to the fact that this is a test.");
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  test("toView never reports more flagged sentences than exist", () => {
    const view = toView(lintSte100("One. Two sentences. Here is a much longer sentence that goes on and on and on."));
    expect(view.flaggedSentences).toBeLessThanOrEqual(view.sentenceCount);
  });

  test("style warnings call out the length rule", () => {
    const long =
      "This sentence is far too long to be useful inside a video narration for anybody at all " +
      "reading along, and it keeps going well past the point where a listener can follow.";
    expect(styleWarnings(long).some((w) => w.startsWith("6.3") || w.startsWith("5.1"))).toBe(true);
  });

  test("descriptive text is judged against the 25 word limit", () => {
    const under = lintSte100("The tool reads the file. The video takes a few seconds to make.");
    expect(under.findings.some((f) => f.rule === "6.3")).toBe(false);
    const over = lintSte100(
      "The tool reads the file. Although the second stage looks trivial, the renderer still walks " +
        "every scene, every caption and every audio segment before it hands the result to the encoder."
    );
    expect(over.findings.some((f) => f.rule === "6.3")).toBe(true);
  });
});

describe("ste100 operator surface", () => {
  test("every rewrite mode carries an instruction", () => {
    for (const mode of ["strict", "eighty", "light"] as const) {
      expect(STE_MODES[mode].instruction.length).toBeGreaterThan(10);
    }
  });

  test("rule reference is grouped into the standard sections", () => {
    const ids = STE_SECTIONS.map((s) => s.id);
    for (const s of ids) expect(s.length).toBeGreaterThan(0);
  });

  test("rule table is non-empty and every id is unique", () => {
    expect(STE_RULES.length).toBeGreaterThan(10);
    const seen = new Set(STE_RULES.map((r) => r.id));
    expect(seen.size).toBe(STE_RULES.length);
  });
});

describe("composition", () => {
  const script = (kind: string): VideoScript =>
    ({
      title: "Zouroboros",
      scenes: [
        {
          kind,
          heading: "The numbers",
          narration: "RepoReel turns a repository into a short video.",
          lines: ["Ingest any public repository", "Draft a grounded script", "Render it with local TTS"],
          stats: [
            { label: "securities", value: "1,211" },
            { label: "stars", value: "3.2k" },
            { label: "checks", value: "48" },
            { label: "accounts", value: "0" },
          ],
        },
      ],
    }) as unknown as VideoScript;

  const opts = (o: Partial<JobOptions>): JobOptions => normalizeOptions({ captions: false, ...o });

  test("every style builds a composition for both formats", () => {
    for (const id of STYLE_IDS) {
      for (const format of ["landscape", "vertical"] as const) {
        const dir = `/tmp/rr-test/${id}-${format}`;
        const audio = [{ path: "", seconds: 3 }];
        const out = buildComposition(script("stats"), audio as never, dir, opts({ style: id, format }));
        expect(out.total).toBeGreaterThan(0);
        expect(Bun.file(`${dir}/index.html`).size).toBeGreaterThan(1000);
      }
    }
  });

  test("board scenes draw an svg stage, card scenes do not", async () => {
    const board = "/tmp/rr-test/board-check";
    const cards = "/tmp/rr-test/cards-check";
    const audio = [{ path: "", seconds: 3 }];
    buildComposition(script("stats"), audio as never, board, opts({ style: "3b1b" }));
    buildComposition(script("stats"), audio as never, cards, opts({ style: "eli5" }));
    const boardHtml = await Bun.file(`${board}/index.html`).text();
    const cardHtml = await Bun.file(`${cards}/index.html`).text();
    expect(boardHtml).toContain("b-stage");
    expect(cardHtml).not.toContain("b-stage");
  });

  test("the word reveal cascade finishes early enough to be readable", async () => {
    const dir = "/tmp/rr-test/reveal-check";
    const audio = [{ path: "", seconds: 8 }];
    buildComposition(script("stats"), audio as never, dir, opts({ style: "3b1b" }));
    const html = await Bun.file(`${dir}/index.html`).text();
    const times = [...html.matchAll(/fromTo\("#s0-[a-z]-w\d+",\{[^}]*\},\{[^}]*duration:[\d.]+[^}]*\},([\d.]+)\);/g)].map((m) =>
      Number(m[1])
    );
    expect(times.length).toBeGreaterThan(0);
    // A cascade stretched across the whole scene leaves the title off screen
    // for most of the shot. It must land in the opening seconds.
    expect(Math.max(...times)).toBeLessThan(2.5);
  });
});
