import { join } from "node:path";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import type { VideoScript, Scene } from "./script";
import type { SceneAudio } from "./tts";

const GSAP_SRC = join(import.meta.dir, "..", "..", "node_modules", "gsap", "dist", "gsap.min.js");

const W = 1280;
const H = 720;
const LEAD = 0.5;
const AUDIO_OFFSET = 0.4;
const TAIL = 0.9;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function titleSize(t: string): number {
  if (t.length <= 12) return 92;
  if (t.length <= 20) return 72;
  if (t.length <= 30) return 56;
  return 44;
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

function sceneBody(s: Scene, i: number): string {
  const h = `<div class="heading" id="s${i}-h">${esc(s.heading)}</div>`;
  if (s.kind === "title") {
    return `<div class="center-col">
      <div class="eyebrow" id="s${i}-e">${esc(s.heading)}</div>
      <div class="big-title" id="s${i}-t" style="font-size:${titleSize(s.lines?.[0] ?? s.heading)}px">${esc(s.lines?.[0] ?? s.heading)}</div>
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
      <div class="big-title" id="s${i}-t" style="font-size:${titleSize(s.heading)}px">${esc(s.heading)}</div>
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

export function buildComposition(
  script: VideoScript,
  audio: SceneAudio[],
  jobDir: string
): { total: number } {
  mkdirSync(join(jobDir, "assets"), { recursive: true });
  copyFileSync(GSAP_SRC, join(jobDir, "gsap.min.js"));
  const { timings, total } = computeTimings(audio);
  const scenes = script.scenes
    .map(
      (s, i) => `<section class="clip scene" id="scene-${i}" data-start="${timings[i]!.start.toFixed(2)}" data-duration="${timings[i]!.dur.toFixed(2)}" data-track-index="1">
        <div class="scene-inner" id="s${i}-inner">${sceneBody(s, i)}</div>
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
<meta name="viewport" content="width=${W}, height=${H}" />
<title>${esc(script.title)} — RepoReel</title>
<script src="gsap.min.js"></script>
<style>
  body { margin: 0; background: #07090d; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  #root { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; background: #07090d; color: #e7edf5; }
  #bg { position: absolute; inset: 0; background: radial-gradient(1000px 600px at 18% 10%, rgba(34,211,238,.13), transparent 60%), radial-gradient(900px 640px at 85% 88%, rgba(167,139,250,.12), transparent 60%), linear-gradient(160deg, #0b0f16 0%, #07090d 100%); }
  #bg-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(231,237,245,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(231,237,245,.035) 1px, transparent 1px); background-size: 64px 64px; }
  #glow-a { position: absolute; width: 520px; height: 520px; border-radius: 50%; background: radial-gradient(circle, rgba(34,211,238,.16), transparent 70%); top: -140px; left: -120px; }
  #glow-b { position: absolute; width: 620px; height: 620px; border-radius: 50%; background: radial-gradient(circle, rgba(167,139,250,.14), transparent 70%); bottom: -200px; right: -160px; }
  #watermark { position: absolute; right: 28px; bottom: 20px; font-size: 15px; letter-spacing: .14em; color: rgba(231,237,245,.4); font-weight: 600; }
  #watermark b { color: rgba(34,211,238,.75); font-weight: 700; }
  .scene { position: absolute; inset: 0; }
  .scene-inner { position: absolute; inset: 0; display: flex; }
  .center-col { margin: auto; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 22px; padding: 0 90px; }
  .pad-col { display: flex; flex-direction: column; justify-content: center; gap: 34px; padding: 0 110px; width: 100%; box-sizing: border-box; }
  .eyebrow { font-size: 20px; letter-spacing: .32em; text-transform: uppercase; color: #22d3ee; font-weight: 700; }
  .big-title { font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; }
  .tagline { font-size: 27px; color: #9aa7b8; max-width: 900px; line-height: 1.4; }
  .heading { font-size: 44px; font-weight: 800; letter-spacing: -0.01em; }
  .stat-row { display: flex; gap: 26px; }
  .stat-card { flex: 1; background: rgba(231,237,245,.045); border: 1px solid rgba(231,237,245,.09); border-radius: 18px; padding: 34px 22px; text-align: center; }
  .stat-value { font-size: 52px; font-weight: 800; color: #22d3ee; letter-spacing: -0.02em; }
  .stat-label { margin-top: 10px; font-size: 19px; color: #9aa7b8; text-transform: uppercase; letter-spacing: .12em; }
  .list-col, .text-col { display: flex; flex-direction: column; gap: 26px; }
  .list-item { display: flex; align-items: center; gap: 22px; }
  .list-bar { width: 6px; height: 44px; border-radius: 3px; background: linear-gradient(180deg, #22d3ee, #a78bfa); }
  .list-text { font-size: 31px; color: #cdd7e3; font-weight: 500; }
  .text-line { font-size: 33px; color: #cdd7e3; line-height: 1.35; font-weight: 500; max-width: 980px; }
  .code-panel { background: #0c1118; border: 1px solid rgba(231,237,245,.09); border-radius: 16px; padding: 26px 32px 30px; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .code-dots { display: flex; gap: 9px; margin-bottom: 20px; }
  .dot { width: 13px; height: 13px; border-radius: 50%; }
  .d1 { background: #f87171; } .d2 { background: #fbbf24; } .d3 { background: #34d399; }
  .code-line { font-size: 25px; color: #b7e3ef; padding: 7px 0; }
  .code-prompt { color: #a78bfa; margin-right: 10px; }
  .outro-brand { margin-top: 26px; font-size: 21px; color: #9aa7b8; }
  .brand-accent { color: #22d3ee; font-weight: 700; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${total}">
  <div id="bg"></div>
  <div id="bg-grid"></div>
  <div id="glow-a"></div>
  <div id="glow-b"></div>
${scenes}
${audios}
  <div id="watermark"><b>Repo</b>Reel</div>
</div>
<script>
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
tl.fromTo("#glow-a",{x:0,y:0},{x:90,y:60,duration:${total},ease:"none"},0);
tl.fromTo("#glow-b",{x:0,y:0},{x:-80,y:-50,duration:${total},ease:"none"},0);
${tweens}
window.__timelines["main"] = tl;
</script>
</body>
</html>
`;
  writeFileSync(join(jobDir, "index.html"), html);
  return { total };
}
