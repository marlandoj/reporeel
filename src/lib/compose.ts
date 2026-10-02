import { join } from "node:path";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import type { VideoScript, Scene } from "./script";
import type { SceneAudio } from "./tts";
import { FORMATS, type Format, type JobOptions } from "./options";
import { STYLES, type StyleSpec } from "./styles";
import { buildCaptions, toSrt, type Caption } from "./captions";

const GSAP_SRC = join(import.meta.dir, "..", "..", "node_modules", "gsap", "dist", "gsap.min.js");

const LEAD = 0.5;
const AUDIO_OFFSET = 0.4;
const TAIL = 0.9;

type Layout = {
  format: Format;
  w: number;
  h: number;
  fs: number;
  padX: number;
  statCols: number;
  gridPx: number;
  captionBottom: number;
  captionMax: number;
  contentLift: number;
  titleSizes: [number, number, number, number];
  heading: number;
  list: number;
  text: number;
  code: number;
  codeChar: number;
};

const LAYOUTS: Record<Format, Layout> = {
  landscape: { format: "landscape", w: 1280, h: 720, fs: 1, padX: 110, statCols: 4, gridPx: 64, captionBottom: 54, captionMax: 60, contentLift: 70, titleSizes: [92, 72, 56, 44], heading: 44, list: 31, text: 33, code: 25, codeChar: 20 },
  vertical: { format: "vertical", w: 720, h: 1280, fs: 0.92, padX: 54, statCols: 2, gridPx: 56, captionBottom: 250, captionMax: 34, contentLift: 220, titleSizes: [78, 64, 52, 42], heading: 38, list: 30, text: 32, code: 23, codeChar: 19 },
  square: { format: "square", w: 1080, h: 1080, fs: 1.05, padX: 90, statCols: 2, gridPx: 60, captionBottom: 110, captionMax: 44, contentLift: 120, titleSizes: [90, 72, 58, 46], heading: 44, list: 32, text: 34, code: 26, codeChar: 21 },
};

/** 3Blue1Brown's mobject palette, used by the board renderer. */
const MC = {
  blue: "#58C4DD",
  green: "#83C167",
  red: "#FC6255",
  orange: "#FF9E4A",
  purple: "#C08CFF",
  cream: "#FFFFCC",
  white: "#FFFFFF",
  gray: "#9E9E9E",
} as const;

const RING = [MC.blue, MC.green, MC.orange, MC.purple, MC.red];

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Largest size at which `text` still fits on one line inside `boxW`.
 * Estimates the glyph run as 0.58 em per character, close for the heavy sans
 * and serif faces the styles use, and errs toward a smaller size.
 */
function fitSize(text: string, boxW: number, max: number, min: number, emPerChar = 0.58): number {
  const longest = (text || "").split("\n").reduce((m, l) => Math.max(m, l.length), 0);
  if (!longest || boxW <= 0) return max;
  return Math.max(min, Math.min(max, Math.floor(boxW / (longest * emPerChar))));
}

function titleSize(t: string, L: Layout): number {
  const [a, b, c, d] = L.titleSizes;
  if (t.length <= 12) return a;
  if (t.length <= 20) return b;
  if (t.length <= 30) return c;
  return d;
}

type Timing = { start: number; dur: number };

function computeTimings(audio: SceneAudio[]): { timings: Timing[]; total: number } {
  const timings: Timing[] = [];
  let t = LEAD;
  for (const a of audio) {
    const dur = Math.max(3.2, a.seconds + AUDIO_OFFSET + TAIL);
    timings.push({ start: t, dur });
    t += dur;
  }
  return { timings, total: Math.round((t + 0.6) * 100) / 100 };
}

/* ------------------------------------------------------------------ *
 * Progressive text reveal
 * ------------------------------------------------------------------ */

type Reveal = {
  /** Word-mode entries: element id prefix plus its word count. */
  words: { id: string; n: number }[];
  /** Typewriter entries: element id plus its word count. */
  typed: { id: string; n: number }[];
  field: (text: string, id: string) => string;
};

function makeReveal(st: StyleSpec): Reveal {
  const r: Reveal = { words: [], typed: [], field: () => "" };
  if (st.reveal === "type") {
    r.field = (text, id) => {
      const n = text.trim() ? text.trim().split(/\s+/).length : 0;
      if (n) r.typed.push({ id, n });
      return esc(text);
    };
    return r;
  }
  if (st.reveal === "word") {
    r.field = (text, id) => {
      let n = 0;
      const html = text
        .split(/(\s+)/)
        .map((p) => (p.trim() ? `<span class="wd" id="${id}-w${n++}">${esc(p)}</span>` : esc(p)))
        .join("");
      if (n) r.words.push({ id, n });
      return html;
    };
    return r;
  }
  r.field = (text) => esc(text);
  return r;
}

function revealTweens(r: Reveal, from: number, to: number, st: StyleSpec): string {
  if (r.words.length === 0 && r.typed.length === 0) return "";
  const words = r.words.reduce((a, w) => a + w.n, 0);
  // A cascade should read as one gesture, not a scroll. Give every word a
  // tenth of a second, capped, so the last word is on screen early in the scene.
  const budget = words > 0 ? words * 0.1 + 0.25 : 0;
  const span = Math.max(0.7, Math.min(to - from, budget));
  const out: string[] = [];
  if (r.words.length > 0) {
    const total = words || 1;
    let k = 0;
    for (const w of r.words) {
      const a = from + (k / total) * span;
      const b = from + ((k + w.n) / total) * span;
      const step = w.n > 1 ? (b - a) / (w.n - 1) : 0;
      for (let j = 0; j < w.n; j++) {
        out.push(
          `tl.fromTo("#${w.id}-w${j}",{opacity:0,${st.revealAxis}:${st.revealShift}},{opacity:1,${st.revealAxis}:0,duration:${st.revealDur},ease:"${st.enter}"},${(a + j * step).toFixed(2)});`
        );
      }
      k += w.n;
    }
  }
  for (const t of r.typed) {
    const share = span * (t.n / Math.max(1, r.typed.reduce((a, x) => a + x.n, 0)));
    out.push(typewriter(t.id, share));
  }
  return out.join("\n");
}

function typewriter(id: string, dur: number): string {
  return `window.__rrType(${JSON.stringify(id)},${Math.max(0.25, dur).toFixed(2)});`;
}

/* ------------------------------------------------------------------ *
 * Card layout (studio, eli5, whiteboard, terminal)
 * ------------------------------------------------------------------ */

function codeLines(s: Scene, L: Layout): { text: string; long: number } {
  const budget = Math.max(14, Math.floor(L.w * 0.66 / Math.max(8, L.codeChar)));
  return { text: (s.lines ?? []).slice(0, 3).join("\n"), long: budget };
}

function sceneBody(s: Scene, i: number, L: Layout, r: Reveal): string {
  const head = r.field(s.heading, `s${i}-h`);
  const h = `<div class="heading" id="s${i}-h">${head}</div>`;
  if (s.kind === "title") {
    const title = r.field(s.lines?.[0] ?? s.heading, `s${i}-t`);
    const tagline = s.lines?.[1] ? r.field(s.lines[1], `s${i}-g`) : "";
    return `<div class="center-col">
      <div class="eyebrow" id="s${i}-e">${head}</div>
      <div class="big-title" id="s${i}-twrap" style="font-size:${titleSize(s.lines?.[0] ?? s.heading, L)}px">${title}</div>
      ${tagline ? `<div class="tagline" id="s${i}-gwrap">${tagline}</div>` : ""}
    </div>`;
  }
  if (s.kind === "stats") {
    const cards = (s.stats ?? [])
      .slice(0, 4)
      .map(
        (st, j) => `<div class="stat-card" id="s${i}-c${j}">
          <div class="stat-value" id="s${i}-v${j}">${esc(st.value)}</div>
          <div class="stat-label">${esc(st.label)}</div>
        </div>`
      )
      .join("");
    return `<div class="pad-col">${h}<div class="stat-row">${cards}</div></div>`;
  }
  if (s.kind === "list") {
    const items = (s.lines ?? [])
      .slice(0, 3)
      .map(
        (l, j) => `<div class="list-item" id="s${i}-l${j}">
          <div class="list-bar"></div>
          <div class="list-text" id="s${i}-lt${j}">${r.field(l, `s${i}-lt${j}`)}</div>
        </div>`
      )
      .join("");
    return `<div class="pad-col">${h}<div class="list-col">${items}</div></div>`;
  }
  if (s.kind === "code") {
    const { text, long } = codeLines(s, L);
    return `<div class="pad-col">${h}
      <div class="code-panel" id="s${i}-p">
        <div class="code-dots"><span class="dot d1"></span><span class="dot d2"></span><span class="dot d3"></span></div>
        <pre class="code-body" id="s${i}-b" data-budget="${long}">${esc(text)}</pre>
      </div>
    </div>`;
  }
  if (s.kind === "equation") {
    const parts = (s.lines ?? []).slice(0, 3);
    const op = kindOp((s.lines ?? []).length);
    return `<div class="center-col">
      ${h}
      <div class="eq" id="s${i}-e1">${parts.map((l, j) => r.field(l, `s${i}-e${j}`)).join(`<span class="eq-op">${op}</span>`)}</div>
    </div>`;
  }
  if (s.kind === "analogy") {
    const [lhs, rhs] = s.lines ?? [];
    return `<div class="pad-col">${h}
      <div class="ana-row">
        <div class="ana-box" id="s${i}-a">${lhs ? r.field(lhs, `s${i}-a`) : ""}</div>
        <div class="ana-arrow" id="s${i}-ar">&#8594;</div>
        <div class="ana-box ana-like" id="s${i}-b">${rhs ? r.field(rhs, `s${i}-b`) : ""}</div>
      </div>
    </div>`;
  }
  if (s.kind === "outro") {
    const line = s.lines?.[0] ? r.field(s.lines[0], `s${i}-g`) : "";
    return `<div class="center-col">
      <div class="big-title" id="s${i}-twrap" style="font-size:${titleSize(s.heading, L)}px">${head}</div>
      ${line ? `<div class="tagline" id="s${i}-gwrap">${line}</div>` : ""}
      <div class="outro-brand" id="s${i}-b">made with <span class="brand-accent">RepoReel</span> · no account required</div>
    </div>`;
  }
  const lines = (s.lines ?? [])
    .slice(0, 3)
    .map((l, j) => `<div class="text-line" id="s${i}-l${j}">${r.field(l, `s${i}-l${j}`)}</div>`)
    .join("");
  return `<div class="pad-col">${h}<div class="text-col">${lines}</div></div>`;
}

function kindOp(j: number): string {
  return j === 0 ? "+" : j === 1 ? "&#215;" : "+";
}

function cardSceneTweens(s: Scene, i: number, t: Timing, r: Reveal, st: StyleSpec, out: string[]): void {
  const at = (off: number) => (t.start + off).toFixed(2);
  if (s.kind === "title") {
    out.push(`tl.fromTo("#s${i}-e",{y:22,opacity:0},{y:0,opacity:1,duration:${st.d},ease:"${st.enter}"},${at(0.12)});`);
    out.push(`tl.fromTo("#s${i}-twrap",{y:34,opacity:0},{y:0,opacity:1,duration:${st.d},ease:"${st.enter}"},${at(0.24)});`);
    if (documentExists(s, "g")) out.push(`tl.fromTo("#s${i}-gwrap",{y:20,opacity:0},{y:0,opacity:1,duration:${st.d},ease:"${st.enter}"},${at(0.42)});`);
  } else if (s.kind === "stats") {
    out.push(`tl.fromTo("#s${i}-h",{y:26,opacity:0},{y:0,opacity:1,duration:${st.d},ease:"${st.enter}"},${at(0.08)});`);
    for (let j = 0; j < (s.stats ?? []).slice(0, 4).length; j++) {
      out.push(`tl.fromTo("#s${i}-c${j}",{y:30,opacity:0,scale:.94},{y:0,opacity:1,scale:1,duration:${st.popDur},ease:"${st.pop}"},${at(0.3 + j * st.statStagger)});`);
    }
  } else if (s.kind === "outro") {
    out.push(`tl.fromTo("#s${i}-twrap",{y:30,opacity:0},{y:0,opacity:1,duration:${st.d},ease:"${st.enter}"},${at(0.16)});`);
    if (documentExists(s, "g")) out.push(`tl.fromTo("#s${i}-gwrap",{y:18,opacity:0},{y:0,opacity:1,duration:${st.d},ease:"${st.enter}"},${at(0.36)});`);
    out.push(`tl.fromTo("#s${i}-b",{opacity:0},{opacity:1,duration:.7,ease:"${st.enter}"},${at(0.7)});`);
  } else if (s.kind === "code") {
    out.push(`tl.fromTo("#s${i}-h",{y:26,opacity:0},{y:0,opacity:1,duration:${st.d},ease:"${st.enter}"},${at(0.08)});`);
    out.push(`tl.fromTo("#s${i}-p",{y:24,opacity:0},{y:0,opacity:1,duration:${st.d},ease:"${st.enter}"},${at(0.24)});`);
    out.push(`tl.fromTo("#s${i}-b",{opacity:0},{opacity:1,duration:${st.typeDur},ease:"none"},${at(0.42)});`);
  } else if (s.kind === "equation" || s.kind === "analogy") {
    out.push(`tl.fromTo("#s${i}-h",{y:26,opacity:0},{y:0,opacity:1,duration:${st.d},ease:"${st.enter}"},${at(0.08)});`);
    const boxes = s.kind === "analogy" ? ["a", "ar", "b"] : ["e1"];
    boxes.forEach((b, j) => out.push(`tl.fromTo("#s${i}-${b}",{y:24,opacity:0},{y:0,opacity:1,duration:${st.popDur},ease:"${st.pop}"},${at(0.3 + j * 0.12)});`));
  } else {
    out.push(`tl.fromTo("#s${i}-h",{y:26,opacity:0},{y:0,opacity:1,duration:${st.d},ease:"${st.enter}"},${at(0.08)});`);
    for (let j = 0; j < (s.lines ?? []).slice(0, 3).length; j++) {
      const delay = st.reveal === "word" || st.reveal === "type" ? 0.2 : 0.3 + j * st.slideStagger;
      out.push(`tl.fromTo("#s${i}-l${j}",{x:${st.slideFrom},opacity:0},{x:0,opacity:1,duration:${st.slideDur},ease:"${st.motion.ease}"},${at(delay)});`);
    }
  }
  out.push(`tl.fromTo("#s${i}-inner",{scale:${st.camFrom}},{scale:1,duration:${t.dur.toFixed(2)},ease:"none"},${t.start.toFixed(2)});`);
}

function documentExists(s: Scene, key: string): boolean {
  if (key === "g") return Boolean(s.lines && s.lines[1]);
  return true;
}

/* ------------------------------------------------------------------ *
 * Board layout (3b1b)
 * ------------------------------------------------------------------ */

type Box = { x: number; y: number; w: number; h: number };
type Node = { defs: string; t: string[] };
type Mobjects = { defs: string; nodes: Node[] };

function boards(L: Layout, format: Format): { text: Box; stage: Box; vertical: boolean } {
  const W = L.w;
  const H = L.h;
  const px = (n: number) => Math.round(n * L.fs);
  if (format === "vertical") {
    return {
      vertical: true,
      text: { x: px(L.padX), y: Math.round(H * 0.05), w: W - px(L.padX * 2), h: Math.round(H * 0.37) },
      stage: { x: Math.round(W * 0.06), y: Math.round(H * 0.44), w: Math.round(W * 0.88), h: Math.round(H * 0.48) },
    };
  }
  if (format === "square") {
    return {
      vertical: true,
      text: { x: px(L.padX), y: Math.round(H * 0.05), w: W - px(L.padX * 2), h: Math.round(H * 0.34) },
      stage: { x: Math.round(W * 0.06), y: Math.round(H * 0.41), w: Math.round(W * 0.88), h: Math.round(H * 0.5) },
    };
  }
  return {
    vertical: false,
    text: { x: px(L.padX), y: 0, w: Math.round(W * 0.32), h: H },
    stage: { x: Math.round(W * 0.36), y: Math.round(H * 0.13), w: Math.round(W * 0.6), h: Math.round(H * 0.74) },
  };
}

function boardMobjects(scene: Scene, index: number, B: Box, L: Layout, last: boolean): Mobjects {
  const nodes: Node[] = [];
  const ox = `m${index}`;
  const lw = Math.max(4, Math.round(5 * L.fs));
  const fsLabel = Math.max(18, Math.round(26 * L.fs));
  const fsValMax = Math.max(40, Math.round(84 * L.fs));
  const at = (d: number) => (0.3 + d).toFixed(2);
  const base = B.y + B.h;

  const grow = (id: string, dur = 0.55, ease = "back.out(1.8)") =>
    `tl.fromTo("#${id}",{scale:0},{scale:1,duration:${dur},ease:"${ease}"},${at(0)});`;
  const draw = (id: string, dur = 0.6) => `tl.fromTo("#${id}",{scaleX:0},{scaleX:1,duration:${dur},ease:"power2.inOut"},${at(0)});`;

  if (scene.kind === "title" || scene.kind === "outro") {
    const n = 7;
    const nodesArr: { x: number; y: number }[] = [];
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (k / n) * Math.PI * 2;
      nodesArr.push({ x: B.x + B.w / 2 + Math.cos(a) * B.w * 0.3, y: B.y + B.h / 2 + Math.sin(a) * B.h * 0.32 });
    }
    const center = { x: B.x + B.w / 2, y: B.y + B.h / 2 };
    nodesArr.forEach((p, k) => {
      if (k > 0) {
        const prev = nodesArr[k - 1]!;
        const id = `${ox}-edge${k}`;
        nodes.push({ defs: `<line id="${id}" x1="${prev.x.toFixed(1)}" y1="${prev.y.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="${MC.gray}" stroke-width="${Math.max(2, lw - 2)}" opacity=".55" />`, t: [draw(id, 0.5)] });
      }
      const id = `${ox}-n${k}`;
      const r = Math.round(Math.min(B.w, B.h) * 0.045);
      nodes.push({
        defs: `<circle id="${id}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="none" stroke="${RING[k % RING.length]}" stroke-width="${lw}" />`,
        t: [grow(id)],
      });
    });
    nodes.push({
      defs: `<circle id="${ox}-core" cx="${center.x.toFixed(1)}" cy="${center.y.toFixed(1)}" r="${Math.round(Math.min(B.w, B.h) * 0.12)}" fill="${MC.blue}" />`,
      t: [`tl.fromTo("#${ox}-core",{scale:0},{scale:1,duration:.7,ease:"back.out(2)"},${at(0.25)});`],
    });
    return { defs: nodes.map((n2) => n2.defs).join("\n    "), nodes };
  }

  if (scene.kind === "stats") {
    const stats = (scene.stats ?? []).slice(0, 4);
    const padL = Math.round(L.fs * 40);
    const padB = Math.round(L.fs * 54);
    const axX = B.x + padL;
    const axY = base - padB;
    const gw = B.w - padL - Math.round(L.fs * 16);
    const gh = B.h - padB - Math.round(L.fs * 74);
    const axisY = Math.max(axY - gh, axY - Math.round(gh * 0.62));
    nodes.push({ defs: `<line id="${ox}-ax" x1="${axX}" y1="${axisY}" x2="${axX}" y2="${axY}" stroke="${MC.white}" stroke-width="${lw}" />`, t: [draw(`${ox}-ax`, 0.45)] });
    const axisX = `${ox}-axx`;
    nodes.push({ defs: `<line id="${axisX}" x1="${axX}" y1="${axY}" x2="${axX + gw}" y2="${axY}" stroke="${MC.white}" stroke-width="${lw}" />`, t: [draw(axisX, 0.45)] });
    const bw = Math.round((gw - 14 * L.fs * stats.length) / Math.max(1, stats.length));
    const widest = stats.reduce((a, st) => Math.max(a, st.value.trim().length), 1);
    const fsVal = Math.max(22, Math.min(fsValMax, Math.floor((bw * 0.92) / (widest * 0.62))));
    stats.forEach((st, k) => {
      const x = axX + Math.round(k * (bw + 14 * L.fs));
      const num = firstNumber(st.value);
      const hRatio = 0.3 + 0.7 * ((index * 3 + k) % 4) / 3;
      const bh = Math.max(Math.round(18 * L.fs), Math.round(gh * hRatio));
      const col = RING[k % RING.length]!;
      const bid = `${ox}-b${k}`;
      nodes.push({
        defs: `<rect id="${bid}" x="${x}" y="${axY - bh}" width="${bw}" height="${bh}" fill="${col}" />`,
        t: [`tl.fromTo("#${bid}",{scaleY:0},{scaleY:1,duration:.6,ease:"power3.out"},${at(0.5 + k * 0.16)});`],
      });
      const tid = `${ox}-t${k}`;
      nodes.push({
        defs: `<text id="${tid}" x="${(x + bw / 2).toFixed(1)}" y="${(axY - bh - fsVal * 0.24).toFixed(1)}" text-anchor="middle" font-family="cmmi10, cmr10, serif" font-style="italic" font-size="${fsVal}" fill="${MC.white}">${esc(st.value)}</text>`,
        t: [`tl.fromTo("#${tid}",{opacity:0,scale:.5},{opacity:1,scale:1,duration:.5,ease:"back.out(1.6)"},${at(0.7 + k * 0.16)});`],
      });
      const lid = `${ox}-l${k}`;
      nodes.push({
        defs: `<text id="${lid}" x="${(x + bw / 2).toFixed(1)}" y="${axY + fsLabel + Math.round(L.fs * 8)}" text-anchor="middle" font-size="${fsLabel}" fill="${MC.gray}">${esc(st.label)}</text>`,
        t: [`tl.fromTo("#${lid}",{opacity:0},{opacity:1,duration:.4,ease:"none"},${at(0.9 + k * 0.16)});`],
      });
    });
    return { defs: nodes.map((n2) => n2.defs).join("\n    "), nodes };
  }

  if (scene.kind === "list") {
    const lines = (scene.lines ?? []).slice(0, 3);
    const r = Math.round(Math.min(B.w, B.h) * 0.07);
    const cx = B.x + r + Math.round(L.fs * 6);
    const top = B.y + r + Math.round(L.fs * 6);
    const gap = (B.h - 2 * r - Math.round(L.fs * 12)) / Math.max(1, lines.length - 1 || 1);
    const bottom = lines.length > 1 ? top + gap * (lines.length - 1) : top;
    const spine = `${ox}-sp`;
    nodes.push({ defs: `<line id="${spine}" x1="${cx}" y1="${top}" x2="${cx}" y2="${bottom.toFixed(1)}" stroke="${MC.gray}" stroke-width="${Math.max(2, lw - 2)}" opacity=".6" />`, t: [draw(spine, Math.max(0.3, 0.35 * lines.length))] });
    lines.forEach((l, k) => {
      const cy = top + gap * k;
      const col = RING[(k + 1) % RING.length]!;
      const did = `${ox}-d${k}`;
      nodes.push({
        defs: `<circle id="${did}" cx="${cx}" cy="${cy.toFixed(1)}" r="${r}" fill="${col}" />`,
        t: [`tl.fromTo("#${did}",{scale:0},{scale:1,duration:.45,ease:"back.out(2)"},${at(0.35 + k * 0.3)});`],
      });
      const tid = `${ox}-tl${k}`;
      const tx = cx + r + Math.round(L.fs * 22);
      const maxChars = Math.max(10, Math.floor((B.x + B.w - tx) / (fsLabel * 0.52)));
      nodes.push({
        defs: `<text id="${tid}" x="${tx}" y="${(cy + fsLabel * 0.36).toFixed(1)}" font-size="${fsLabel}" fill="${MC.white}">${esc(ellipsize(l, maxChars))}</text>`,
        t: [`tl.fromTo("#${tid}",{opacity:0,scale:.85},{opacity:1,scale:1,duration:.45,ease:"power2.out"},${at(0.55 + k * 0.3)});`],
      });
    });
    return { defs: nodes.map((n2) => n2.defs).join("\n    "), nodes };
  }

  if (scene.kind === "code") {
    const { text, long } = codeLines(scene, L);
    const x = B.x + Math.round(L.fs * 20);
    const y = B.y + Math.round(L.fs * 14);
    const w = Math.max(120, B.w - Math.round(L.fs * 70));
    const h = Math.max(70, B.h - Math.round(L.fs * 34));
    const bid = `${ox}-panel`;
    nodes.push({ defs: `<rect id="${bid}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.round(L.fs * 12)}" fill="#1b1b1b" stroke="${MC.gray}" stroke-width="${Math.max(2, lw - 2)}" opacity=".92" />`, t: [grow(bid, 0.5, "power2.out")] });
    const gid = `${ox}-glyph`;
    nodes.push({
      defs: `<text id="${gid}" x="${(x + w + Math.round(L.fs * 22)).toFixed(1)}" y="${(y + h * 0.72).toFixed(1)}" font-family="cmr10, serif" font-size="${Math.round(Math.min(B.h * 0.7, 240 * L.fs))}" fill="${MC.gray}" opacity=".8">{ }</text>`,
      t: [`tl.fromTo("#${gid}",{opacity:0},{opacity:.8,duration:.5,ease:"none"},${at(0.35)});`],
    });
    void text;
    void long;
    const rows = (scene.lines ?? []).slice(0, long ? 6 : 3);
    const pad = Math.round(L.fs * 16);
    const avail = Math.max(40, w - pad * 2);
    const codeFs = Math.max(13, Math.min(Math.round(L.fs * 26), Math.floor(avail / Math.max(1, Math.max(...rows.map((r) => r.length)) * 0.6))));
    const lineH = Math.round(codeFs * 2.1);
    const blockH = lineH * rows.length;
    const top = y + (h - blockH) / 2 + codeFs;
    rows.forEach((line, k) => {
      const rid = `${ox}-c${k}`;
      nodes.push({
        defs: `<text id="${rid}" x="${(x + pad).toFixed(1)}" y="${(top + k * lineH).toFixed(1)}" font-size="${codeFs}" fill="${k === 0 ? MC.gray : MC.blue}"><tspan xml:space="preserve">${esc(ellipsize(line, Math.floor(avail / (codeFs * 0.54))))}</tspan></text>`,
        t: [`tl.fromTo("#${rid}",{opacity:0,x:-14},{opacity:1,x:0,duration:.45,ease:"power2.out"},${at(0.5 + k * 0.22)});`],
      });
    });
    const cid = `${ox}-cur`;
    nodes.push({ defs: `<rect id="${cid}" x="${(x + pad).toFixed(1)}" y="${(top + Math.round(codeFs * 1.1)).toFixed(1)}" width="${Math.round(codeFs * 0.7)}" height="${Math.round(codeFs * 1.3)}" fill="${MC.green}" />`, t: [] });
    nodes[nodes.length - 1]!.t.push(`tl.fromTo("#${cid}",{opacity:0},{opacity:1,duration:.2,ease:"none"},${at(0.9)});`);
    nodes[nodes.length - 1]!.t.push(`tl.to("#${cid}",{opacity:0,duration:.2,ease:"none"},${at(1.9)});`);
    return { defs: nodes.map((n2) => n2.defs).join("\n    "), nodes };
  }

  if (scene.kind === "equation") {
    const parts = (scene.lines ?? []).slice(0, 3);
    const y = B.y + B.h / 2;
    const size = Math.max(30, Math.round(Math.min(B.h * 0.5, 130 * L.fs)));
    const gid = `${ox}-brace`;
    nodes.push({ defs: `<text id="${gid}" x="${B.x + Math.round(10 * L.fs)}" y="${(y + size * 0.35).toFixed(1)}" font-family="cmr10, serif" font-size="${size}" fill="${MC.gray}" opacity=".7">{</text>`, t: [`tl.fromTo("#${gid}",{opacity:0},{opacity:.7,duration:.4,ease:"none"},${at(0.2)});`] });
    const budget = Math.max(10, Math.floor((B.w * 0.8) / (size * 0.46)));
    parts.forEach((p, k) => {
      const tid = `${ox}-q${k}`;
      const col = RING[(k + 1) % RING.length]!;
      nodes.push({
        defs: `<text id="${tid}" x="${(B.x + B.w * (0.16 + 0.3 * k)).toFixed(1)}" y="${y.toFixed(1)}" font-family="cmmi10, cmr10, serif" font-style="italic" font-size="${size}" fill="${col}">${esc(ellipsize(p, budget))}</text>`,
        t: [`tl.fromTo("#${tid}",{opacity:0,scale:.7},{opacity:1,scale:1,duration:.5,ease:"back.out(1.5)"},${at(0.5 + k * 0.45)});`],
      });
      if (k < parts.length - 1) {
        const opId = `${ox}-op${k}`;
        const ox2 = B.x + B.w * (0.16 + 0.3 * k) + size * 1.5;
        nodes.push({
          defs: `<text id="${opId}" x="${ox2.toFixed(1)}" y="${y.toFixed(1)}" font-family="cmsy10, cmr10, serif" font-size="${Math.round(size * 0.8)}" fill="${MC.white}" opacity=".9">+</text>`,
          t: [`tl.fromTo("#${opId}",{opacity:0},{opacity:.9,duration:.3,ease:"none"},${at(0.8 + k * 0.45)});`],
        });
      }
    });
    return { defs: nodes.map((n2) => n2.defs).join("\n    "), nodes };
  }

  if (scene.kind === "analogy") {
    const [lhs, rhs] = scene.lines ?? [];
    const bw = (B.w - Math.round(L.fs * 70)) / 2;
    const bh = Math.max(50, B.h * 0.42);
    const y = B.y + B.h / 2 - bh / 2;
    const lid = `${ox}-lhs`;
    const rid = `${ox}-rhs`;
    nodes.push({ defs: `<rect id="${lid}" x="${B.x}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${Math.round(L.fs * 14)}" fill="none" stroke="${MC.blue}" stroke-width="${lw}" />`, t: [grow(lid, 0.5, "power2.out")] });
    nodes.push({ defs: `<rect id="${rid}" x="${(B.x + bw + 70 * L.fs).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${Math.round(L.fs * 14)}" fill="none" stroke="${MC.orange}" stroke-width="${lw}"/>`, t: [grow(rid, 0.5, "power2.out")] });
    const aid = `${ox}-arw`;
    const ay = y + bh / 2;
    const a1 = B.x + bw + Math.round(L.fs * 12);
    const a2 = B.x + bw + Math.round(70 * L.fs) - Math.round(L.fs * 12);
    nodes.push({
      defs: `<g id="${aid}"><line x1="${a1}" y1="${ay.toFixed(1)}" x2="${a2}" y2="${ay.toFixed(1)}" stroke="${MC.white}" stroke-width="${lw}"/><polygon points="${a2 + Math.round(14 * L.fs)},${ay.toFixed(1)} ${a2},${(ay - Math.round(9 * L.fs)).toFixed(1)} ${a2},${(ay + Math.round(9 * L.fs)).toFixed(1)}" fill="${MC.white}"/></g>`,
      t: [`tl.fromTo("#${aid}",{opacity:0},{opacity:1,duration:.4,ease:"none"},${at(0.85)});`],
    });
    const textIn = (tid: string, label: string | undefined, bx: number, col: string) => {
      if (!label) return;
      const budget = Math.max(6, Math.floor((bw - 20 * L.fs) / (fsLabel * 0.52)));
      nodes.push({
        defs: `<text id="${tid}" x="${(bx + bw / 2).toFixed(1)}" y="${(y + bh / 2 + fsLabel * 0.35).toFixed(1)}" text-anchor="middle" font-size="${fsLabel}" fill="${col}">${esc(ellipsize(label, budget))}</text>`,
        t: [`tl.fromTo("#${tid}",{opacity:0},{opacity:1,duration:.4,ease:"none"},${at(1.05)});`],
      });
    };
    textIn(`${ox}-lt`, lhs, B.x, MC.white);
    textIn(`${ox}-rt`, rhs, B.x + bw + 70 * L.fs, MC.white);
    return { defs: nodes.map((n2) => n2.defs).join("\n    "), nodes };
  }

  // text
  const rid = `${ox}-ring`;
  const r = Math.min(B.w, B.h) * 0.32;
  const cx = B.x + B.w / 2;
  const cy = B.y + B.h / 2;
  nodes.push({ defs: `<circle id="${rid}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${MC.blue}" stroke-width="${lw}" />`, t: [grow(rid, 0.7, "power3.out")] });
  const r2 = r * 0.58;
  const rid2 = `${ox}-ring2`;
  nodes.push({ defs: `<circle id="${rid2}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r2.toFixed(1)}" fill="none" stroke="${MC.green}" stroke-width="${Math.max(2, lw - 1)}" />`, t: [grow(rid2, 0.6, "power3.out")] });
  const mid = `${ox}-mid`;
  nodes.push({ defs: `<circle id="${mid}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${Math.max(8, Math.round(r2 * 0.24))}" fill="${MC.white}" />`, t: [grow(mid, 0.4, "back.out(2.2)")] });
  for (let k = 0; k < 3; k++) {
    const a = -Math.PI * 0.75 + (k / 3) * Math.PI * 1.5;
    const px1 = cx + Math.cos(a) * r * 1.06;
    const py1 = cy + Math.sin(a) * r * 1.06;
    const px2 = cx + Math.cos(a) * r * 1.5;
    const py2 = cy + Math.sin(a) * r * 1.5;
    const eid = `${ox}-e${k}`;
    nodes.push({ defs: `<line id="${eid}" x1="${px1.toFixed(1)}" y1="${py1.toFixed(1)}" x2="${px2.toFixed(1)}" y2="${py2.toFixed(1)}" stroke="${RING[(k + 2) % RING.length]}" stroke-width="${Math.max(2, lw - 1)}" />`, t: [grow(eid, 0.4, "power2.out")] });
  }
  return { defs: nodes.map((n2) => n2.defs).join("\n    "), nodes };
}

function firstNumber(s: string): number | null {
  const m = s.match(/(\d[\d,]*(?:\.\d+)?)/);
  if (!m) return null;
  return Number(m[1]!.replace(/,/g, ""));
}

function ellipsize(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, Math.max(1, max - 1))}…`;
}

/**
 * Scene kinds whose mobject already renders `scene.lines`. For these the left
 * column is the topic and nothing else, so the two columns never say the same
 * thing twice.
 */
const MOBJECT_CARRIES_LINES = new Set(["stats", "list", "code", "equation", "analogy"]);

function boardText(s: Scene, i: number, r: Reveal, t: Box, L: Layout): string {
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

  if (s.kind === "title" || s.kind === "outro") {
    const head = s.kind === "title" ? s.lines?.[0] ?? s.heading : s.heading;
    const tag = s.kind === "title" ? s.lines?.[1] ?? "" : s.lines?.[0] ?? "";
    const size = fitSize(head, t.w, L.titleSizes[0] ?? 92, 34, 0.56);
    return `<div class="b-title" id="s${i}-twrap" style="font-size:${size}px">${r.field(head, `s${i}-t`)}</div>` +
      (tag ? `<div class="b-tag" id="s${i}-gwrap" style="font-size:${Math.round(size * 0.3)}px">${r.field(tag, `s${i}-g`)}</div>` : "");
  }

  if (MOBJECT_CARRIES_LINES.has(s.kind)) {
    const size = clamp(t.w / 9.5, 30, 54);
    return `<div class="b-h" id="s${i}-hwrap" style="font-size:${size}px">${r.field(s.heading, `s${i}-h`)}</div>`;
  }

  const lines = s.lines ?? [];
  const stmt = lines[0] ?? s.heading;
  const rest = lines.slice(1, 3);
  const stmtSize = clamp(t.w / 11, 26, 46);
  return (
    `<div class="b-eyebrow" id="s${i}-ewrap">${r.field(s.heading, `s${i}-e`)}</div>` +
    `<div class="b-stmt" id="s${i}-twrap" style="font-size:${stmtSize}px">${r.field(stmt, `s${i}-t`)}</div>` +
    rest
      .map(
        (l, j) =>
          `<div class="b-line" id="s${i}-l${j}" style="font-size:${clamp((t.w / Math.max(12, l.length)) * 1.6, 17, 30)}px">${r.field(l, `s${i}-l${j}`)}</div>`
      )
      .join("")
  );
}

function boardScene(s: Scene, i: number, t: Timing, B: Box, textBox: Box, vertical: boolean, r: Reveal, isLast: boolean, st: StyleSpec, L: Layout): { html: string; tween: string } {
  const mo = boardMobjects(s, i, B, L, isLast);
  const box = `left:${textBox.x}px;top:${textBox.y}px;width:${textBox.w}px;height:${textBox.h}px`;
  const text = `<div class="b-text ${vertical ? "v" : ""}" style="${box}">${boardText(s, i, r, textBox, L)}</div>`;
  const svg = `<div class="b-stage"><svg viewBox="0 0 ${L.w} ${L.h}" width="${L.w}" height="${L.h}" preserveAspectRatio="xMidYMid meet">${mo.defs}</svg></div>`;
  const out: string[] = [];
  const at = (o: number) => (t.start + o).toFixed(2);
  for (const n of mo.nodes) {
    for (const stmt of n.t) out.push(offsetTween(stmt, t.start));
  }
  out.push(revealTweens(r, t.start + 0.15, t.start + t.dur - 0.7, st));
  out.push(`tl.fromTo("#s${i}-inner",{scale:1.035},{scale:1,duration:${t.dur.toFixed(2)},ease:"none"},${t.start.toFixed(2)});`);
  return {
    html: `<section class="clip scene board-scene" id="scene-${i}" data-start="${t.start.toFixed(2)}" data-duration="${t.dur.toFixed(2)}" data-track-index="1"><div class="scene-inner" id="s${i}-inner">${text}${svg}</div></section>`,
    tween: out.join("\n"),
  };
}

/* ------------------------------------------------------------------ *
 * Style chrome
 * ------------------------------------------------------------------ */

/**
 * Board layout stylesheet: two columns, text on the left, an SVG "stage" on the
 * right. This is the 3Blue1Brown frame, so it is themed entirely by the CSS
 * variables the active style declares.
 */
function boardCss(L: Layout, B: ReturnType<typeof boards>): string {
  const px = (n: number) => Math.round(n * L.fs);
  const t = B.text;
  return `
  #bg { background: var(--bg); }
  #bg-grid { display: none; }
  #glow-a, #glow-b { display: none; }
  #board-cam { position: absolute; inset: 0; transform-origin: 50% 50%; }
  .board-scene .b-text {
    position: absolute; display: flex; flex-direction: column; justify-content: center;
    gap: ${px(14)}px; overflow: hidden;
    font-size: ${px(B.vertical ? L.heading : L.heading * 1.05)}px; line-height: 1.25; color: var(--fg);
  }
  .b-text .b-eyebrow { font-size: ${px(17)}px; letter-spacing: .3em; text-transform: uppercase; color: var(--accent-2); font-weight: 700; }
  .b-text .b-h { font-weight: 800; letter-spacing: -.015em; line-height: 1.1; }
  .b-text .b-stmt { font-weight: 800; letter-spacing: -.02em; line-height: 1.08; }
  .b-text .b-line { color: var(--muted); font-weight: 500; line-height: 1.3; }
  .b-text .wd { display: inline-block; white-space: pre; }
  .b-stage { position: absolute; inset: 0; }
  .b-stage svg, .b-stage svg * { transform-box: fill-box; transform-origin: 50% 50%; }
  .b-stage svg { position: absolute; left: 0; top: 0; }
  .b-text .b-title { font-weight: 800; letter-spacing: -.02em; line-height: 1.04; overflow-wrap: anywhere; }
  .b-text .b-tag { color: var(--muted); font-weight: 500; }
  .watermark { z-index: 6; }
  .cap { z-index: 6; }
  .scene-inner { padding-bottom: 0 !important; }
  #boxes { right: ${px(28)}px; top: ${px(18)}px; bottom: auto; font-size: ${px(14)}px; letter-spacing: .14em; color: var(--muted); opacity: .5; }
`;
}

function styleCss(st: StyleSpec, L: Layout): string {
  const px = (n: number) => Math.round(n * L.fs);
  return `:root{${st.vars}}
  body { margin: 0; background: var(--bg); color: var(--fg); font-family: var(--font); }
  #root { position: relative; width: ${L.w}px; height: ${L.h}px; overflow: hidden; background: var(--bg); color: var(--fg); }
  #bg { position: absolute; inset: 0; background: linear-gradient(160deg, var(--bg-far) 0%, var(--bg) 100%); }
  #bg-grid { position: absolute; inset: 0; background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px); background-size: ${L.gridPx}px ${L.gridPx}px; opacity: .45; }
  #watermark { position: absolute; right: ${px(28)}px; bottom: ${px(20)}px; font-size: ${px(15)}px; letter-spacing: .14em; color: var(--faint); font-weight: 600; }
  #watermark b { color: var(--accent); font-weight: 700; }
  .center-col { margin: auto; display: flex; flex-direction: column; align-items: center; text-align: center; gap: ${px(22)}px; padding: 0 ${L.padX}px; }
  .pad-col { display: flex; flex-direction: column; justify-content: center; gap: ${px(34)}px; padding: 0 ${L.padX}px; width: 100%; box-sizing: border-box; }
  .eyebrow { font-size: ${px(20)}px; letter-spacing: var(--eyebrow-tracking); text-transform: uppercase; color: var(--accent); font-weight: 700; }
  .big-title { font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; overflow-wrap: anywhere; }
  .tagline { font-size: ${px(27)}px; color: var(--muted); max-width: ${px(900)}px; line-height: 1.4; }
  .heading { font-size: ${px(L.heading)}px; font-weight: 800; letter-spacing: -0.01em; overflow-wrap: anywhere; }
  .stat-row { display: grid; grid-template-columns: repeat(${L.statCols}, 1fr); gap: ${px(26)}px; }
  .stat-card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: ${px(34)}px ${px(22)}px; text-align: center; }
  .stat-value { font-size: ${px(52)}px; font-weight: 800; color: var(--accent); letter-spacing: -0.02em; }
  .stat-label { margin-top: ${px(10)}px; font-size: ${px(19)}px; color: var(--muted); text-transform: uppercase; letter-spacing: .12em; }
  .list-col, .text-col { display: flex; flex-direction: column; gap: ${px(26)}px; }
  .list-item { display: flex; align-items: center; gap: ${px(22)}px; }
  .list-bar { width: ${px(6)}px; min-height: ${px(44)}px; align-self: stretch; border-radius: 3px; background: linear-gradient(180deg, var(--accent), var(--accent-2)); flex-shrink: 0; }
  .list-text { font-size: ${px(L.list)}px; color: var(--fg); font-weight: 500; line-height: 1.25; }
  .text-line { font-size: ${px(L.text)}px; color: var(--fg); line-height: 1.35; font-weight: 500; max-width: ${px(980)}px; }
  .code-panel { background: var(--code-bg); border: 1px solid var(--line); border-radius: var(--radius); padding: ${px(26)}px ${px(32)}px ${px(30)}px; font-family: var(--mono); }
  .code-dots { display: flex; gap: 9px; margin-bottom: ${px(20)}px; }
  .dot { width: 13px; height: 13px; border-radius: 50%; }
  .d1 { background: #f87171; } .d2 { background: #fbbf24; } .d3 { background: #34d399; }
  .code-body { font-size: ${px(L.code)}px; line-height: 1.5; color: var(--accent-3); white-space: pre-wrap; overflow-wrap: anywhere; }
  .outro-brand { margin-top: ${px(26)}px; font-size: ${px(21)}px; color: var(--muted); }
  .brand-accent { color: var(--accent); font-weight: 700; }
  .eq { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: ${px(18)}px; }
  .eq-chip { font-family: var(--math); font-style: italic; font-size: ${px(L.heading)}px; color: var(--accent); border: 1px solid var(--line); background: var(--panel); border-radius: var(--radius); padding: ${px(12)}px ${px(22)}px; }
  .eq-op { font-size: ${px(L.list)}px; color: var(--muted); }
  .ana-row { display: flex; align-items: center; gap: ${px(20)}px; }
  .ana-box { flex: 1; min-width: 0; border: ${px(3)}px solid var(--accent); border-radius: var(--radius); background: var(--panel); padding: ${px(24)}px ${px(26)}px; font-size: ${px(L.list)}px; font-weight: 600; line-height: 1.3; }
  .ana-like { border-color: var(--accent-2); }
  .ana-arrow { font-size: ${px(38)}px; color: var(--muted); }
${st.css}`;
}

/** Shift a scene-relative tween statement onto the master timeline. */
function offsetTween(stmt: string, t0: number): string {
  return stmt.replace(/,(\s*)(-?\d+(?:\.\d+)?)\);/, (_m, sp, num) => `,${sp}${(Number(num) + t0).toFixed(2)});`);
}

/** Very slow drift on the whole frame so a still scene never feels dead. */
function camScript(st: StyleSpec, total: number): string {
  return `tl.fromTo("#root",{transformOrigin:"50% 50%",scale:1},{scale:${(1 + st.cam * 2).toFixed(4)},duration:${total},ease:"none"},0);`;
}

/* ------------------------------------------------------------------ *
 * Shared page scaffolding
 * ------------------------------------------------------------------ */

function pageShell(o: {
  title: string;
  L: Layout;
  st: StyleSpec;
  body: string;
  audios: string;
  captions: string;
  spec: { ratio: string };
  total: number;
  camScript: string;
  extraCss?: string;
  wrap: (inner: string) => string;
}): string {
  const L = o.L;
  const px = (n: number) => Math.round(n * L.fs);
  const t = o.total;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${L.w}, height=${L.h}" />
<title>${esc(o.title)} — RepoReel</title>
<script src="gsap.min.js"></script>
<style>${styleCss(o.st, L)}${o.extraCss ?? ""}
  .wd { display: inline-block; white-space: pre; }
  .scene { position: absolute; inset: 0; }
  .scene-inner { position: absolute; inset: 0; display: flex; box-sizing: border-box; }
  .cap { position: absolute; left: 50%; transform: translateX(-50%); bottom: ${L.captionBottom}px; max-width: ${L.w - 2 * Math.round(L.padX * 0.6)}px; padding: ${px(11)}px ${px(20)}px; border-radius: ${px(13)}px; background: var(--cap-bg, rgba(7,9,13,.78)); border: 1px solid var(--cap-border, rgba(231,237,245,.1)); color: var(--cap-fg, #f5f8fb); font-size: ${px(L.format === "landscape" ? 30 : 34)}px; font-weight: 700; line-height: 1.25; text-align: center; opacity: 0; box-sizing: border-box; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${L.w}" data-height="${L.h}" data-duration="${t}">
${o.wrap(o.body)}
${o.audios}
  <div id="captions">${o.captions}</div>
  <div id="watermark"><b>Repo</b>Reel · ${o.spec.ratio}</div>
</div>
<script>
window.__timelines = window.__timelines || {};
window.__rrType = function (id, dur) {
  var el = document.getElementById(id);
  if (!el) return;
  var text = el.textContent;
  el.textContent = "";
  var cur = document.createElement("span");
  cur.textContent = "\\u2588";
  el.appendChild(cur);
  var i = 0;
  var per = Math.max(8, (dur * 1000) / Math.max(1, text.length));
  var iv = setInterval(function () {
    if (i >= text.length) { clearInterval(iv); setTimeout(function () { if (cur.parentNode) cur.parentNode.removeChild(cur); }, 70); return; }
    cur.textContent = text.charAt(i);
    i++;
  }, per);
};
const tl = gsap.timeline({ paused: true });
${o.camScript}
</script>
</body>
</html>
`;
}

function captionMarkup(caps: Caption[]): string {
  return caps.map((c, k) => `<div class="cap" id="cap-${k}">${esc(c.text)}</div>`).join("\n");
}

function captionTweens(caps: Caption[]): string {
  return caps
    .map((c, k) => `tl.fromTo("#cap-${k}",{opacity:0,y:8},{opacity:1,y:0,duration:.18,ease:"power2.out"},${c.start.toFixed(2)});tl.set("#cap-${k}",{opacity:0},${c.end.toFixed(2)});`)
    .join("\n");
}

function audioTrack(audio: SceneAudio[], timings: Timing[]): string {
  return audio
    .map(
      (a, i) => `<audio id="nar-${i}" src="${a.file}" data-start="${(timings[i]!.start + AUDIO_OFFSET).toFixed(2)}" data-duration="${a.seconds.toFixed(2)}" data-track-index="10" data-volume="1"></audio>`
    )
    .join("\n");
}

function captionSet(script: VideoScript, audio: SceneAudio[], timings: Timing[], L: Layout, opts: JobOptions): { caps: Caption[]; srt: string | null } {
  if (!opts.captions) return { caps: [], srt: null };
  const caps = buildCaptions(
    script.scenes.map((s) => s.narration),
    timings.map((t) => t.start + AUDIO_OFFSET),
    audio.map((a) => a.seconds),
    L.captionMax
  );
  return { caps, srt: toSrt(caps) };
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

export function buildComposition(
  script: VideoScript,
  audio: SceneAudio[],
  jobDir: string,
  opts: JobOptions
): { total: number; captions: Caption[] } {
  const L = LAYOUTS[opts.format];
  const spec = FORMATS[opts.format];
  const st = STYLES[opts.style];
  const px = (n: number) => Math.round(n * L.fs);
  mkdirSync(join(jobDir, "assets"), { recursive: true });
  copyFileSync(GSAP_SRC, join(jobDir, "gsap.min.js"));
  const { timings, total } = computeTimings(audio);
  const { caps, srt } = captionSet(script, audio, timings, L, opts);
  if (srt) writeFileSync(join(jobDir, "out.srt"), srt);

  if (st.layout === "board") {
    return buildBoard(script, audio, jobDir, opts, L, spec, timings, total, caps);
  }

  const r = makeReveal(st);
  const scenes = script.scenes
    .map(
      (s, i) => `<section class="clip scene" id="scene-${i}" data-start="${timings[i]!.start.toFixed(2)}" data-duration="${timings[i]!.dur.toFixed(2)}" data-track-index="1">
        <div class="scene-inner" id="s${i}-inner">${sceneBody(s, i, L, r)}</div>
      </section>`
    )
    .join("\n");
  const tweens: string[] = [];
  script.scenes.forEach((s, i) => cardSceneTweens(s, i, timings[i]!, r, st, tweens));

  const lift = opts.captions ? L.contentLift : 0;
  const sceneCss = `  .scene-inner { padding-bottom: ${lift}px; }`;
  const body = `  <div id="bg"></div>
  <div id="bg-grid"></div>
${scenes}`;
  const cam = camScript(st, total);
  const html = pageShell({
    title: script.title,
    L,
    st,
    body,
    audios: audioTrack(audio, timings),
    captions: captionMarkup(caps),
    spec,
    total,
    extraCss: sceneCss + st.css,
    wrap: (inner) => inner,
    camScript: `${cam}\n${tweens.join("\n")}\n${captionTweens(caps)}\nwindow.__timelines["main"] = tl;`,
  });
  writeFileSync(join(jobDir, "index.html"), html);
  return { total, captions: caps };
}

function buildBoard(
  script: VideoScript,
  audio: SceneAudio[],
  jobDir: string,
  opts: JobOptions,
  L: Layout,
  spec: { ratio: string; label: string },
  timings: Timing[],
  total: number,
  caps: Caption[]
): { total: number; captions: Caption[] } {
  const st = STYLES[opts.style];
  const px = (n: number) => Math.round(n * L.fs);
  const B = boards(L, opts.format);
  const out: string[] = [];
  const html = script.scenes
    .map((s, i) => {
      const local = makeReveal({ ...st, reveal: "word" });
      const built = boardScene(s, i, timings[i]!, B.stage, B.text, B.vertical, local, i === script.scenes.length - 1, st, L);
      out.push(built.tween);
      return built.html;
    })
    .join("\n");

  const cam = `tl.fromTo("#board-cam",{scale:1},{scale:1.035,duration:${total},ease:"none"},0);`;
  const page = pageShell({
    title: script.title,
    L,
    st,
    body: `  <div id="bg"></div>
  <div id="board-cam">
${html}
  </div>`,
    audios: audioTrack(audio, timings),
    captions: captionMarkup(caps),
    spec,
    total,
    extraCss: st.css + boardCss(L, B),
    wrap: (inner) => inner,
    camScript: `${cam}\n${out.join("\n")}\n${captionTweens(caps)}\nwindow.__timelines["main"] = tl;`,
  });
  writeFileSync(join(jobDir, "index.html"), page);
  return { total, captions: caps };
}
