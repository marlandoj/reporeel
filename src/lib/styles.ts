import type { JobOptions, Format } from "./options";

export type Style = "studio" | "3b1b" | "eli5" | "whiteboard" | "terminal";

/** Selectable style ids, in the order the operator dropdown lists them. */
export const STYLE_IDS: Style[] = ["studio", "3b1b", "eli5", "whiteboard", "terminal"];

export type Motion = {
  ease: string;
  pop: string;
  dur: number;
  stagger: number;
  rise: number;
  slide: number;
  drift: number;
};

export type StyleSpec = {
  id: Style;
  layout: "cards" | "board";
  motion: Motion;
  /** How on-screen text arrives: per word, per character, or all at once. */
  reveal: "word" | "type" | "group";
  /** Which axis the text reveal travels along. */
  revealAxis: "x" | "y";
  revealShift: number;
  revealDur: number;
  /** Timing knobs, already scaled by the layout scale factor. */
  d: number;
  enter: string;
  pop: string;
  popDur: number;
  typeDur: number;
  slideFrom: number;
  slideDur: number;
  slideStagger: number;
  statStagger: number;
  /** Slow push-in on the whole scene. */
  cam: number;
  camFrom: number;
  /** System-prompt fragment: how the narrator should talk. */
  voice: string;
  /** System-prompt fragment: which scene kinds to favour and how to use them. */
  blueprint: string;
  /** One-line description surfaced in the reel review panel. */
  note: string;
  /** Word families the style voice is not allowed to use. */
  avoid: RegExp[];
  /** Human name for the avoid list, used in warnings. */
  avoidLabel: string;
  /** Scene kinds the style blueprint wants. */
  expect: { analogy: boolean; equation: boolean };
  /** Dropdown label. */
  label: string;
  /** Dropdown blurb. */
  blurb: string;
  vars: string;
  css: string;
};

const SHARED_VOICE_TAIL =
  "- Every on-screen line, heading, and tagline must be a complete self-contained phrase. Never split a sentence across lines or scenes, never end a line mid-thought.\n" +
  "- Narration must flow as one continuous voiceover when read scene after scene.\n" +
  "- Never claim awards, rankings, placements, adoption, or outcomes unless the data states them explicitly.\n" +
  "- No emojis anywhere. Values like \"12.4k\" for numbers over 999.";

const SHARED_BLUEPRINT_TAIL =
  "Use \"list\" for features or use cases, \"code\" for tech stack or key files, \"text\" for the core idea. " +
  "Only use \"analogy\" and \"equation\" if the style section above asks for them.";

/**
 * 3Blue1Brown / ELI5 / etc. prompt fragments.
 */
const VOICE: Record<Style, string> = {
  studio:
    "Write for a developer audience that scans fast. Be concrete and specific. Prefer a real number, a real file path, or a real dependency over an adjective.",
  "3b1b":
    "Write like a patient, delighted teacher thinking out loud in front of a blackboard. Build exactly one idea per scene, from something the audience can picture to the general point.\n" +
    "- Each scene starts from a concrete picture: a quantity, a growth, a comparison, or a set of parts.\n" +
    "- On screen, prefer one short statement, one vivid number, or one small relationship between two named things. Never a paragraph of text.\n" +
    "- The narration may point at the picture: \"so here is the number that matters\", \"look at how this splits\". Pointing is welcome.\n" +
    "- It is fine to be enthusiastic about a genuinely interesting technique. It is not fine to hype.\n" +
    "- Never say \"simply\", \"just\", or \"leverage\".",
  eli5:
    "Write for a smart ten-year-old who is curious but has never opened a terminal.\n" +
    "- Use everyday words only. If a technical word is unavoidable, define it in the same sentence with a plain comparison.\n" +
    "- Sentences are short: under twelve words wherever you can manage it.\n" +
    "- Use concrete images: a notebook, a recipe, a box of tools, a team, a game, a map.\n" +
    "- Exactly one analogy per scene, and the analogy must carry the idea, not just decorate it.\n" +
    "- Be warm and encouraging. Never condescending. Never use \"obviously\", \"simply\", \"just\", or \"leverage\".",
  whiteboard:
    "Write the way someone talks while sketching in front of a room. Conversational, one idea at a time, with a concrete example from the repository in every scene.\n" +
    "- Short sentences. Plain words. The odd clause that sounds spoken is good.\n" +
    "- Prefer a specific number or a specific file over a general claim.",
  terminal:
    "Write terse operational copy, like a build log or release notes. Present tense, active voice, short lines, numbers early. No warm-up.",
};

const BLUEPRINT: Record<Style, string> = {
  studio: "Use \"text\" for the core idea, \"list\" for features or use cases, and \"code\" for the tech stack or key files.",
  "3b1b":
    "Use the scene kinds this way: title, text (one idea, stated as a short claim), stats (one number set, drawn as a chart), equation (one small relationship between named things, for example \"3 kinds  ->  one pipeline\"), code, outro. " +
    "The equation scene must not invent numbers: use only symbols, arrows, and words that already appear in the data.",
  eli5:
    "Use the scene kinds this way: title, analogy (a real thing from the repository on line 1, a plain comparison on line 2), list, text, stats, outro. " +
    "Include exactly one analogy scene and one stats scene. The analogy is a metaphor, so its second line may be invented, but its first line must describe something that is really in the repository.",
  whiteboard:
    "Use the scene kinds this way: title, text, list, code, stats, outro. Keep every line short enough to write by hand.",
  terminal:
    "Use the scene kinds this way: title, stats, list, code, text, outro. Lead every scene with the number or the command.",
};

const MOTION: Record<Style, Motion> = {
  studio: { ease: "power3.out", pop: "back.out(1.4)", dur: 0.55, stagger: 0.14, rise: 30, slide: -26, drift: 1.025 },
  "3b1b": { ease: "power2.out", pop: "back.out(2)", dur: 0.5, stagger: 0.16, rise: 0, slide: 0, drift: 1.0 },
  eli5: { ease: "back.out(1.5)", pop: "elastic.out(1,0.62)", dur: 0.62, stagger: 0.2, rise: 20, slide: 0, drift: 1.012 },
  whiteboard: { ease: "power2.out", pop: "back.out(2.2)", dur: 0.45, stagger: 0.1, rise: 12, slide: -16, drift: 1.008 },
  terminal: { ease: "steps(6)", pop: "steps(1)", dur: 0.1, stagger: 0.045, rise: 0, slide: 0, drift: 1.0 },
};

/** Identity at module scope: the stylesheet numbers in this file are already final pixels. */
const px = (n: number): number => Math.round(n);

export const STYLES: Record<Style, StyleSpec> = {
  studio: {
    id: "studio",
    label: "Studio",
    blurb:
      "The default RepoReel look: dark grid, cyan and violet, technical cards.",
    avoid: [/\b(?:leverage|utiliz|seamless(?:ly)?|game[- ]chang(?:er|ing)|revolutionary|world[- ]class|industry[- ]leading|best[- ]in[- ]class)\b/i],
    avoidLabel: "sales hype",
    expect: { analogy: false, equation: false },
    layout: "cards",
    reveal: "group", revealAxis: "y", revealShift: 28, revealDur: 0.5, d: 0.55, enter: "power3.out", pop: "back.out(1.4)", popDur: 0.55, typeDur: 0.045, slideFrom: 28, slideDur: 0.5, slideStagger: 0.16, statStagger: 0.13, cam: 0.014, camFrom: 1.03,
    motion: MOTION.studio,
    voice: VOICE.studio,
    blueprint: BLUEPRINT.studio,
    note: "Studio look: dark grid, cyan and violet, technical cards.",
    vars: `
  --bg: #07090d;
  --bg-far: #0b0f16;
  --fg: #e7edf5;
  --muted: #9aa7b8;
  --faint: #5b6878;
  --accent: #22d3ee;
  --accent-2: #a78bfa;
  --accent-3: #34d399;
  --panel: rgba(231,237,245,.045);
  --panel-2: rgba(231,237,245,.09);
  --line: rgba(231,237,245,.1);
  --code-bg: #0c1118;
  --radius: 18px;
  --font: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --display: var(--font);
  --mono: "DejaVu Sans Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --math: "cmmi10", "TeX Gyre Termes Math", Georgia, serif;
  --cap-bg: rgba(7,9,13,.78);
  --cap-fg: #f5f8fb;
  --cap-border: rgba(231,237,245,.12);
  --eyebrow-tracking: .32em;`,
    css: "",
  },
  "3b1b": {
    id: "3b1b",
    label: "3b1b",
    blurb:
      "3Blue1Brown: black board, white type, Computer Modern, shapes drawn one at a time.",
    avoid: [/\b(?:leverage|utiliz|seamless(?:ly)?|game[- ]chang(?:er|ing)|revolutionary|world[- ]class|industry[- ]leading|best[- ]in[- ]class)\b/i],
    avoidLabel: "sales hype",
    expect: { analogy: true, equation: true },
    layout: "board",
    reveal: "word", revealAxis: "y", revealShift: 12, revealDur: 0.26, d: 0.5, enter: "power2.out", pop: "back.out(1.7)", popDur: 0.45, typeDur: 0.06, slideFrom: 14, slideDur: 0.42, slideStagger: 0.1, statStagger: 0.1, cam: 0.024, camFrom: 1.06,
    motion: MOTION["3b1b"],
    voice: VOICE["3b1b"],
    blueprint: BLUEPRINT["3b1b"],
    note: "3Blue1Brown look: black board, white type, shapes drawn one at a time.",
    vars: `
  --bg: #08080a;
  --bg-far: #08080a;
  --fg: #ffffff;
  --muted: #c2c2c2;
  --faint: #8a8a8a;
  --accent: #58c4dd;
  --accent-2: #83c167;
  --accent-3: #fc6255;
  --accent-4: #ffa657;
  --panel: #121214;
  --panel-2: rgba(255,255,255,.08);
  --line: rgba(255,255,255,.14);
  --code-bg: #101012;
  --radius: 6px;
  --font: "Inter", system-ui, -apple-system, sans-serif;
  --display: var(--font);
  --mono: "DejaVu Sans Mono", monospace;
  --math: "cmmi10", "cmr10", "TeX Gyre Termes Math", serif;
  --cap-bg: rgba(0,0,0,.66);
  --cap-fg: #ffffff;
  --cap-border: rgba(255,255,255,.1);
  --eyebrow-tracking: .18em;`,
    css: "",
  },
  eli5: {
    id: "eli5",
    label: "ELI5",
    blurb:
      "Explain Like I'm Five: warm paper, big friendly type, everyday comparisons.",
    avoid: [/\b(?:idempotent|ephemeral|asynchronous|abstraction|infrastructure|deterministic|polymorphic|monorepo|orchestrat\w*|imperative|deserializ\w*)\b/i],
    avoidLabel: "jargon",
    expect: { analogy: false, equation: false },
    layout: "cards",
    reveal: "word", revealAxis: "y", revealShift: 18, revealDur: 0.3, d: 0.6, enter: "back.out(1.5)", pop: "back.out(2)", popDur: 0.6, typeDur: 0.04, slideFrom: 20, slideDur: 0.55, slideStagger: 0.2, statStagger: 0.18, cam: 0.01, camFrom: 1.025,
    motion: MOTION.eli5,
    voice: VOICE.eli5,
    blueprint: BLUEPRINT.eli5,
    note: "ELI5 look: warm paper, big friendly type, everyday comparisons.",
    vars: `
  --bg: #fff6e9;
  --bg-far: #fdeacf;
  --fg: #3a2a18;
  --muted: #8a7358;
  --faint: #ab967c;
  --accent: #ef6c2f;
  --accent-2: #1f9e8f;
  --accent-3: #f2b705;
  --panel: #ffffff;
  --panel-2: rgba(58,42,24,.07);
  --line: rgba(58,42,24,.12);
  --code-bg: #fffaf1;
  --radius: 30px;
  --font: "URW Gothic", "DejaVu Sans", system-ui, sans-serif;
  --display: "URW Bookman", "URW Gothic", "DejaVu Serif", Georgia, serif;
  --mono: "DejaVu Sans Mono", monospace;
  --math: "URW Bookman", Georgia, serif;
  --cap-bg: rgba(58,42,24,.86);
  --cap-fg: #fff6e9;
  --cap-border: rgba(58,42,24,.2);
  --eyebrow-tracking: .2em;`,
    css: `
  #bg { background: radial-gradient(140% 120% at 12% 4%, #fffaf1 0%, #ffe9c9 46%, #fbdcb6 100%); }
  #bg-grid { display: none; }
  #glow-a { background: radial-gradient(circle, rgba(239,108,47,.16), transparent 70%); }
  #glow-b { background: radial-gradient(circle, rgba(31,158,143,.15), transparent 70%); }
  .stat-card, .list-item, .code-panel, .ana-card { box-shadow: 0 ${px(10)}px ${px(30)}px rgba(120, 80, 30, .10); }
  .eyebrow { color: var(--accent-2); }
  .stat-value { color: var(--accent); }
  .brand-accent { color: var(--accent); }
  .cap { border-radius: ${px(18)}px; }`,
  },
  whiteboard: {
    id: "whiteboard",
    label: "Whiteboard",
    blurb:
      "Marker on off-white board, tilted cards, hand-drawn underlines.",
    avoid: [/\b(?:idempotent|ephemeral|asynchronous|abstraction|infrastructure|deterministic|polymorphic|monorepo|orchestrat\w*|imperative|deserializ\w*)\b/i],
    avoidLabel: "jargon",
    expect: { analogy: false, equation: false },
    layout: "cards",
    reveal: "word", revealAxis: "x", revealShift: 0, revealDur: 0.1, d: 0.45, enter: "power2.out", pop: "power3.out", popDur: 0.4, typeDur: 0.035, slideFrom: 22, slideDur: 0.4, slideStagger: 0.1, statStagger: 0.12, cam: 0.012, camFrom: 1.03,
    motion: MOTION.whiteboard,
    voice: VOICE.whiteboard,
    blueprint: BLUEPRINT.whiteboard,
    note: "Whiteboard look: marker on off-white board, sketchy placement.",
    vars: `
  --bg: #f4f1e6;
  --bg-far: #e9e4d3;
  --fg: #1c3a63;
  --muted: #55698a;
  --faint: #7b8aa3;
  --accent: #1c3a63;
  --accent-2: #c8452e;
  --accent-3: #2e8b57;
  --panel: rgba(255,255,255,.82);
  --panel-2: rgba(28,58,99,.08);
  --line: rgba(28,58,99,.18);
  --code-bg: rgba(255,255,255,.92);
  --radius: 8px;
  --font: "URW Gothic", "DejaVu Sans", system-ui, sans-serif;
  --display: "URW Bookman", "DejaVu Serif", Georgia, serif;
  --mono: "DejaVu Sans Mono", monospace;
  --math: "cmmi10", "TeX Gyre Termes Math", Georgia, serif;
  --cap-bg: rgba(28,58,99,.88);
  --cap-fg: #fffdf6;
  --cap-border: rgba(28,58,99,.25);
  --eyebrow-tracking: .22em;`,
    css: `
  #bg { background: linear-gradient(178deg, #f7f4ea 0%, #efe9da 100%); }
  #bg-grid { display: none; }
  #glow-a, #glow-b { display: none; }
  .pad-col { transform: rotate(-.4deg); }
  .heading { position: relative; }
  .heading::after { content: ""; position: absolute; left: 0; right: ${px(40)}; bottom: ${px(-10)}; height: ${px(9)}; background: var(--accent-2); opacity: .55; border-radius: ${px(6)}px; transform: rotate(-.7deg); }
  .stat-card { transform: rotate(-.6deg); }
  .list-bar { background: var(--accent-2); border-radius: ${px(3)}px; }
  .eyebrow { color: var(--accent-2); }
  .stat-value { color: var(--accent); }
  .code-panel { border: ${px(3)}px solid var(--line); box-shadow: ${px(5)}px ${px(5)}px 0 rgba(28,58,99,.10); }
  .brand-accent { color: var(--accent-2); }
  .watermark { transform: rotate(-1.2deg); }`,
  },
  terminal: {
    id: "terminal",
    label: "Terminal",
    blurb:
      "Monospace phosphor output, typed in live, green and amber.",
    avoid: [/\b(?:leverage|utiliz|seamless(?:ly)?|game[- ]chang(?:er|ing)|revolutionary|world[- ]class|industry[- ]leading|best[- ]in[- ]class)\b/i],
    avoidLabel: "sales hype",
    expect: { analogy: false, equation: false },
    layout: "cards",
    reveal: "type", revealAxis: "x", revealShift: 0, revealDur: 0.06, d: 0.3, enter: "steps(4)", pop: "steps(3)", popDur: 0.25, typeDur: 0.025, slideFrom: 12, slideDur: 0.28, slideStagger: 0.08, statStagger: 0.1, cam: 0.005, camFrom: 1.012,
    motion: MOTION.terminal,
    voice: VOICE.terminal,
    blueprint: BLUEPRINT.terminal,
    note: "Terminal look: monospace phosphor output, typed in live.",
    vars: `
  --bg: #05070a;
  --bg-far: #05070a;
  --fg: #cdf7c8;
  --muted: #6f9d6b;
  --faint: #4b6f48;
  --accent: #7cff7c;
  --accent-2: #ffb454;
  --accent-3: #5ec8ff;
  --panel: rgba(124,255,124,.04);
  --panel-2: rgba(124,255,124,.14);
  --line: rgba(124,255,124,.22);
  --code-bg: #04060a;
  --radius: 2px;
  --font: "Noto Sans Mono", "DejaVu Sans Mono", monospace;
  --display: var(--font);
  --mono: var(--font);
  --math: var(--font);
  --cap-bg: rgba(4,6,10,.84);
  --cap-fg: #cdf7c8;
  --cap-border: rgba(124,255,124,.24);
  --eyebrow-tracking: .16em;`,
    css: `
  #bg { background: #05070a; }
  #bg-grid { background-image: repeating-linear-gradient(0deg, rgba(124,255,124,.055) 0 1px, transparent 1px ${px(4)}); background-size: auto; }
  #glow-a { background: radial-gradient(circle, rgba(124,255,124,.07), transparent 70%); }
  #glow-b { background: radial-gradient(circle, rgba(94,200,255,.06), transparent 70%); }
  .big-title, .heading, .list-text, .text-line, .stat-value { text-shadow: 0 0 ${px(10)}px rgba(124,255,124,.35); }
  .stat-card, .code-panel, .ana-card { border-radius: ${px(3)}px; }
  .eyebrow::before { content: "$ "; color: var(--faint); }
  .heading::before { content: "## "; color: var(--accent-2); }
  .list-text::before { content: "> "; color: var(--faint); }
  .list-bar { background: var(--accent-2); width: ${px(4)}px; }
  .stat-value { color: var(--accent); }
  .stat-label { color: var(--faint); }
  .outro-brand::after { content: "_"; color: var(--accent); animation: blink 1s steps(1) infinite; }
  .cap { border-radius: ${px(3)}px; font-family: var(--mono); }
  .code-prompt { color: var(--accent-2); }
  .code-line { color: #d8ffe0; }
  .brand-accent { color: var(--accent-2); }`,
  },
};

export function styleSpec(style: Style): StyleSpec {
  return STYLES[style] ?? STYLES.studio;
}


/**
 * Render a style's CSS block with `px()` scaling available.
 */
export function renderStyleCss(spec: StyleSpec, px: (n: number) => number): string {
  return spec.css.replace(/\$\{px\((-?\d+(?:\.\d+)?)\)\}/g, (_, n) => `${px(Number(n))}px`);
}

export function styleSystemPrompt(opts: JobOptions): string {
  const spec = styleSpec(opts.style);
  const f = {
    landscape: "16:9",
    vertical: "9:16",
    square: "1:1",
  }[opts.format as Format]!;
  return [
    `STYLE: ${spec.id}.`,
    spec.voice,
    spec.blueprint,
    SHARED_VOICE_TAIL,
    SHARED_BLUEPRINT_TAIL,
    `The video is ${f}. Keep on-screen text within the character limits above.`,
  ].join("\n");
}
