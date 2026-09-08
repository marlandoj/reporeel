import { join } from "node:path";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import type { VideoScript, Scene } from "./script";
import type { SceneAudio } from "./tts";
import { FORMATS, type Format, type JobOptions } from "./options";
import { buildCaptions, toSrt, type Caption } from "./captions";

const GSAP_SRC = join(import.meta.dir, "..", "..", "node_modules", "gsap", "dist", "gsap.min.js");

const LEAD = 0.5;
const AUDIO_OFFSET = 0.4;
const TAIL = 0.9;

type Layout = {
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
};

const LAYOUTS: Record<Format, Layout> = {
  landscape: { w: 1280, h: 720, fs: 1, padX: 110, statCols: 4, gridPx: 64, captionBottom: 54, captionMax: 60, contentLift: 70, titleSizes: [92, 72, 56, 44] },
  vertical: { w: 720, h: 1280, fs: 0.92, padX: 54, statCols: 2, gridPx: 56, captionBottom: 250, captionMax: 34, contentLift: 220, titleSizes: [78, 64, 52, 42] },
  square: { w: 1080, h: 1080, fs: 1.05, padX: 90, statCols: 2, gridPx: 60, captionBottom: 110, captionMax: 44, contentLift: 120, titleSizes: [90, 72, 58, 46] },
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function sceneBody(s: Scene, i: number, L: Layout): string {
  const h = `<div class="heading" id="s${i}-h">${esc(s.heading)}</div>`;
  if (s.kind === "title") {
    return `<div class="center-col">
      <div class="eyebrow" id="s${i}-e">${esc(s.heading)}</div>
      <div class="big-title" id="s${i}-t" style="font-size:${titleSize(s.lines?.[0] ?? s.heading, L)}px">${esc(s.lines?.[0] ?? s.heading)}</div>
      ${s.lines?.[1] ? `<div class="tagline" id="s${i}-g">${esc(s.lines[1])}</div>` : ""}
    </div>`;
  }
  if (s.kind === "stats") {
    const cards = (s.stats ?? [])
      .slice(0, 4)
      .map(
        (st, j) => `<div class="stat-card" id="s${i}-c${j}">
          <div class="stat-value">${esc(st.value)}</div>
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
          <div class="list-text">${esc(l)}</div>
        </div>`
      )
      .join("");
    return `<div class="pad-col">${h}<div class="list-col">${items}</div></div>`;
  }
  if (s.kind === "code") {
    const rows = (s.lines ?? [])
      .slice(0, 3)
      .map((l, j) => `<div class="code-line" id="s${i}-l${j}"><span class="code-prompt">&gt;</span> ${esc(l)}</div>`)
      .join("");
    return `<div class="pad-col">${h}
      <div class="code-panel" id="s${i}-p">
        <div class="code-dots"><span class="dot d1"></span><span class="dot d2"></span><span class="dot d3"></span></div>
        ${rows}
      </div>
    </div>`;
  }
  if (s.kind === "outro") {
    return `<div class="center-col">
      <div class="big-title" id="s${i}-t" style="font-size:${titleSize(s.heading, L)}px">${esc(s.heading)}</div>
      ${s.lines?.[0] ? `<div class="tagline" id="s${i}-g">${esc(s.lines[0])}</div>` : ""}
      <div class="outro-brand" id="s${i}-b">made with <span class="brand-accent">RepoReel</span> · no account required</div>
    </div>`;
  }
  const lines = (s.lines ?? [])
    .slice(0, 3)
    .map((l, j) => `<div class="text-line" id="s${i}-l${j}">${esc(l)}</div>`)
    .join("");
  return `<div class="pad-col">${h}<div class="text-col">${lines}</div></div>`;
}

function sceneTweens(s: Scene, i: number, t: Timing): string {
  const T = t.start.toFixed(2);
  const out: string[] = [];
  const at = (off: number) => (t.start + off).toFixed(2);
  if (s.kind === "title") {
    out.push(`tl.fromTo("#s${i}-e",{y:24,opacity:0},{y:0,opacity:1,duration:.5,ease:"power3.out"},${at(0.15)});`);
    out.push(`tl.fromTo("#s${i}-t",{y:40,opacity:0},{y:0,opacity:1,duration:.7,ease:"power3.out"},${at(0.3)});`);
    out.push(`if(document.getElementById("s${i}-g"))tl.fromTo("#s${i}-g",{y:24,opacity:0},{y:0,opacity:1,duration:.6,ease:"power3.out"},${at(0.55)});`);
  } else if (s.kind === "stats") {
    out.push(`tl.fromTo("#s${i}-h",{y:30,opacity:0},{y:0,opacity:1,duration:.55,ease:"power3.out"},${at(0.1)});`);
    for (let j = 0; j < (s.stats ?? []).slice(0, 4).length; j++) {
      out.push(`tl.fromTo("#s${i}-c${j}",{y:34,opacity:0,scale:.94},{y:0,opacity:1,scale:1,duration:.55,ease:"back.out(1.4)"},${at(0.35 + j * 0.14)});`);
    }
  } else if (s.kind === "outro") {
    out.push(`tl.fromTo("#s${i}-t",{y:36,opacity:0},{y:0,opacity:1,duration:.7,ease:"power3.out"},${at(0.2)});`);
    out.push(`if(document.getElementById("s${i}-g"))tl.fromTo("#s${i}-g",{y:22,opacity:0},{y:0,opacity:1,duration:.6,ease:"power3.out"},${at(0.45)});`);
    out.push(`tl.fromTo("#s${i}-b",{opacity:0},{opacity:1,duration:.8,ease:"power2.out"},${at(0.8)});`);
  } else {
    out.push(`tl.fromTo("#s${i}-h",{y:30,opacity:0},{y:0,opacity:1,duration:.55,ease:"power3.out"},${at(0.1)});`);
    if (s.kind === "code") {
      out.push(`tl.fromTo("#s${i}-p",{y:30,opacity:0},{y:0,opacity:1,duration:.55,ease:"power3.out"},${at(0.3)});`);
    }
    for (let j = 0; j < (s.lines ?? []).slice(0, 3).length; j++) {
      out.push(`tl.fromTo("#s${i}-l${j}",{x:-26,opacity:0},{x:0,opacity:1,duration:.5,ease:"power3.out"},${at(0.4 + j * 0.16)});`);
    }
  }
  out.push(`tl.fromTo("#s${i}-inner",{scale:1},{scale:1.025,duration:${t.dur.toFixed(2)},ease:"none"},${T});`);
  return out.join("\n");
}

function captionMarkup(caps: Caption[]): string {
  return caps.map((c, k) => `<div class="cap" id="cap-${k}">${esc(c.text)}</div>`).join("\n");
}

function captionTweens(caps: Caption[]): string {
  return caps
    .map((c, k) => `tl.fromTo("#cap-${k}",{opacity:0,y:8},{opacity:1,y:0,duration:.18,ease:"power2.out"},${c.start.toFixed(2)});tl.set("#cap-${k}",{opacity:0},${c.end.toFixed(2)});`)
    .join("\n");
}

export function buildComposition(
  script: VideoScript,
  audio: SceneAudio[],
  jobDir: string,
  opts: JobOptions
): { total: number; captions: Caption[] } {
  const L = LAYOUTS[opts.format];
  const spec = FORMATS[opts.format];
  const px = (n: number) => Math.round(n * L.fs);
  mkdirSync(join(jobDir, "assets"), { recursive: true });
  copyFileSync(GSAP_SRC, join(jobDir, "gsap.min.js"));
  const { timings, total } = computeTimings(audio);
  const captions = opts.captions
    ? buildCaptions(
        script.scenes.map((s) => s.narration),
        timings.map((t) => t.start + AUDIO_OFFSET),
        audio.map((a) => a.seconds),
        L.captionMax
      )
    : [];
  if (opts.captions) writeFileSync(join(jobDir, "out.srt"), toSrt(captions));
  const lift = opts.captions ? L.contentLift : 0;
  const scenes = script.scenes
    .map(
      (s, i) => `<section class="clip scene" id="scene-${i}" data-start="${timings[i]!.start.toFixed(2)}" data-duration="${timings[i]!.dur.toFixed(2)}" data-track-index="1">
        <div class="scene-inner" id="s${i}-inner">${sceneBody(s, i, L)}</div>
      </section>`
    )
    .join("\n");
  const audios = audio
    .map(
      (a, i) => `<audio id="nar-${i}" src="${a.file}" data-start="${(timings[i]!.start + AUDIO_OFFSET).toFixed(2)}" data-duration="${a.seconds.toFixed(2)}" data-track-index="10" data-volume="1"></audio>`
    )
    .join("\n");
  const tweens = script.scenes.map((s, i) => sceneTweens(s, i, timings[i]!)).join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${L.w}, height=${L.h}" />
<title>${esc(script.title)} — RepoReel</title>
<script src="gsap.min.js"></script>
<style>
  body { margin: 0; background: #07090d; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  #root { position: relative; width: ${L.w}px; height: ${L.h}px; overflow: hidden; background: #07090d; color: #e7edf5; }
  #bg { position: absolute; inset: 0; background: radial-gradient(${px(1000)}px ${px(600)}px at 18% 10%, rgba(34,211,238,.13), transparent 60%), radial-gradient(${px(900)}px ${px(640)}px at 85% 88%, rgba(167,139,250,.12), transparent 60%), linear-gradient(160deg, #0b0f16 0%, #07090d 100%); }
  #bg-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(231,237,245,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(231,237,245,.035) 1px, transparent 1px); background-size: ${L.gridPx}px ${L.gridPx}px; }
  #glow-a { position: absolute; width: ${px(520)}px; height: ${px(520)}px; border-radius: 50%; background: radial-gradient(circle, rgba(34,211,238,.16), transparent 70%); top: ${px(-140)}px; left: ${px(-120)}px; }
  #glow-b { position: absolute; width: ${px(620)}px; height: ${px(620)}px; border-radius: 50%; background: radial-gradient(circle, rgba(167,139,250,.14), transparent 70%); bottom: ${px(-200)}px; right: ${px(-160)}px; }
  #watermark { position: absolute; right: ${px(28)}px; bottom: ${px(20)}px; font-size: ${px(15)}px; letter-spacing: .14em; color: rgba(231,237,245,.4); font-weight: 600; }
  #watermark b { color: rgba(34,211,238,.75); font-weight: 700; }
  .scene { position: absolute; inset: 0; }
  .scene-inner { position: absolute; inset: 0; display: flex; padding-bottom: ${lift}px; box-sizing: border-box; }
  .center-col { margin: auto; display: flex; flex-direction: column; align-items: center; text-align: center; gap: ${px(22)}px; padding: 0 ${L.padX}px; }
  .pad-col { display: flex; flex-direction: column; justify-content: center; gap: ${px(34)}px; padding: 0 ${L.padX}px; width: 100%; box-sizing: border-box; }
  .eyebrow { font-size: ${px(20)}px; letter-spacing: .32em; text-transform: uppercase; color: #22d3ee; font-weight: 700; }
  .big-title { font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; overflow-wrap: anywhere; }
  .tagline { font-size: ${px(27)}px; color: #9aa7b8; max-width: ${px(900)}px; line-height: 1.4; }
  .heading { font-size: ${px(44)}px; font-weight: 800; letter-spacing: -0.01em; overflow-wrap: anywhere; }
  .stat-row { display: grid; grid-template-columns: repeat(${L.statCols}, 1fr); gap: ${px(26)}px; }
  .stat-card { background: rgba(231,237,245,.045); border: 1px solid rgba(231,237,245,.09); border-radius: ${px(18)}px; padding: ${px(34)}px ${px(22)}px; text-align: center; }
  .stat-value { font-size: ${px(52)}px; font-weight: 800; color: #22d3ee; letter-spacing: -0.02em; }
  .stat-label { margin-top: ${px(10)}px; font-size: ${px(19)}px; color: #9aa7b8; text-transform: uppercase; letter-spacing: .12em; }
  .list-col, .text-col { display: flex; flex-direction: column; gap: ${px(26)}px; }
  .list-item { display: flex; align-items: center; gap: ${px(22)}px; }
  .list-bar { width: ${px(6)}px; min-height: ${px(44)}px; align-self: stretch; border-radius: 3px; background: linear-gradient(180deg, #22d3ee, #a78bfa); flex-shrink: 0; }
  .list-text { font-size: ${px(31)}px; color: #cdd7e3; font-weight: 500; line-height: 1.25; }
  .text-line { font-size: ${px(33)}px; color: #cdd7e3; line-height: 1.35; font-weight: 500; max-width: ${px(980)}px; }
  .code-panel { background: #0c1118; border: 1px solid rgba(231,237,245,.09); border-radius: ${px(16)}px; padding: ${px(26)}px ${px(32)}px ${px(30)}px; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .code-dots { display: flex; gap: 9px; margin-bottom: ${px(20)}px; }
  .dot { width: 13px; height: 13px; border-radius: 50%; }
  .d1 { background: #f87171; } .d2 { background: #fbbf24; } .d3 { background: #34d399; }
  .code-line { font-size: ${px(25)}px; color: #b7e3ef; padding: ${px(7)}px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .code-prompt { color: #a78bfa; margin-right: 10px; }
  .outro-brand { margin-top: ${px(26)}px; font-size: ${px(21)}px; color: #9aa7b8; }
  .brand-accent { color: #22d3ee; font-weight: 700; }
  .cap { position: absolute; left: 50%; transform: translateX(-50%); bottom: ${L.captionBottom}px; max-width: ${L.w - 2 * Math.round(L.padX * 0.6)}px; padding: ${px(12)}px ${px(22)}px; border-radius: ${px(14)}px; background: rgba(7,9,13,.78); border: 1px solid rgba(231,237,245,.1); color: #f5f8fb; font-size: ${px(opts.format === "landscape" ? 30 : 34)}px; font-weight: 700; line-height: 1.25; text-align: center; opacity: 0; box-sizing: border-box; white-space: normal; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${L.w}" data-height="${L.h}" data-duration="${total}">
  <div id="bg"></div>
  <div id="bg-grid"></div>
  <div id="glow-a"></div>
  <div id="glow-b"></div>
${scenes}
${audios}
  <div id="captions">${captionMarkup(captions)}</div>
  <div id="watermark"><b>Repo</b>Reel · ${spec.ratio}</div>
</div>
<script>
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
tl.fromTo("#glow-a",{x:0,y:0},{x:${px(90)},y:${px(60)},duration:${total},ease:"none"},0);
tl.fromTo("#glow-b",{x:0,y:0},{x:${px(-80)},y:${px(-50)},duration:${total},ease:"none"},0);
${tweens}
${captionTweens(captions)}
window.__timelines["main"] = tl;
</script>
</body>
</html>
`;
  writeFileSync(join(jobDir, "index.html"), html);
  return { total, captions };
}
