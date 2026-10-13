import type { Job } from "./db";
import { FORMATS, parseOptions } from "./options";
import { STYLES, type StyleSpec } from "./styles";

const STYLE_JSON = JSON.stringify(
  Object.fromEntries(
    Object.values(STYLES).map((s: StyleSpec) => [s.id, { label: s.label, blurb: s.blurb }])
  )
);

export type PageContext = { job: Job; poster: boolean } | null;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function metaTags(ctx: PageContext): string {
  if (!ctx || ctx.job.status !== "done") {
    return `<title>RepoReel — paste a repo, get a movie</title>
<meta name="description" content="Turn any public GitHub repo, PR, or release into a narrated explainer video. No accounts, no sign-up, no email. Paste a link, get a movie." />
<meta property="og:title" content="RepoReel — paste a repo, get a movie" />
<meta property="og:description" content="Turn any public GitHub repo, PR, or release into a narrated explainer video. No accounts required." />
<meta property="og:image" content="/og.png" />
<meta name="twitter:card" content="summary_large_image" />`;
  }
  const { job, poster } = ctx;
  const opts = parseOptions(job.options);
  const spec = FORMATS[opts.format];
  const title = `${job.title || job.canonical} — RepoReel`;
  const desc = `A ${Math.round(job.total ?? 60)}s narrated explainer reel for ${job.canonical}, generated from public GitHub data. ${spec.ratio} ${spec.label.toLowerCase()}.`;
  return `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta property="og:type" content="video.other" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="${poster ? `/posters/${job.id}.jpg` : "/og.png"}" />
<meta property="og:video" content="/videos/${job.id}.mp4" />
<meta property="og:video:type" content="video/mp4" />
<meta property="og:video:width" content="${spec.w}" />
<meta property="og:video:height" content="${spec.h}" />
<meta name="twitter:card" content="summary_large_image" />`;
}

export function pageHtml(ctx: PageContext): string {
  const jobId = ctx?.job.id ?? null;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#0d0c0a" />
<meta name="color-scheme" content="dark" />
${metaTags(ctx)}
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23f0a832'/%3E%3Cpath d='M12.5 10.5v11l9.5-5.5z' fill='%23201304'/%3E%3C/svg%3E" />
<style>
  @font-face {
    font-family: "Space Grotesk";
    src: url("/fonts/space-grotesk-latin.woff2") format("woff2");
    font-weight: 500 700;
    font-display: swap;
  }
  @font-face {
    font-family: "JetBrains Mono";
    src: url("/fonts/jetbrains-mono-latin.woff2") format("woff2");
    font-weight: 500 600;
    font-display: swap;
  }
  :root {
    --bg: #0d0c0a;
    --surface: #14120d;
    --surface-2: #1a1712;
    --ink: #efe8d9;
    --muted: #a79b84;
    --faint: #6f6455;
    --dim: #8d8172;
    --line: rgba(239,232,217,.09);
    --line-2: rgba(239,232,217,.2);
    --acc: #f0a832;
    --acc-hi: #ffc966;
    --acc-ink: #201304;
    --acc-soft: rgba(240,168,50,.1);
    --acc-line: rgba(240,168,50,.42);
    --ok: #7bd99a;
    --bad: #f09a8d;
    --r-lg: 20px;
    --r-md: 14px;
    --r-sm: 10px;
    --ease: cubic-bezier(.32,.72,0,1);
    --font-d: "Space Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif;
    --font-m: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  html { -webkit-tap-highlight-color: transparent; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-d);
    font-size: 16px;
    line-height: 1.55;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  ::selection { background: rgba(240,168,50,.32); }
  :focus-visible { outline: 2px solid var(--acc); outline-offset: 3px; border-radius: 6px; }

  .grain { position: fixed; inset: 0; z-index: 200; pointer-events: none; opacity: .05;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E"); }
  .glow { position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background:
      radial-gradient(880px 480px at 12% -4%, rgba(240,168,50,.1), transparent 62%),
      radial-gradient(1200px 700px at 50% 115%, rgba(240,168,50,.05), transparent 60%),
      radial-gradient(closest-side at 50% 50%, transparent 70%, rgba(0,0,0,.42) 130%);
  }

  .wrap { position: relative; z-index: 1; max-width: 1180px; margin: 0 auto; padding: 0 24px; }

  .rise { opacity: 0; transform: translateY(16px); animation: rise .75s var(--ease) forwards; animation-delay: calc(var(--i, 0) * 85ms); }
  @keyframes rise { to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) {
    .rise { animation: none; opacity: 1; transform: none; }
    .step.active .ico { animation: none; }
  }

  .nav { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 22px 0; }
  .logo { display: inline-flex; align-items: center; gap: 11px; text-decoration: none; color: var(--ink); font-size: 21px; font-weight: 700; letter-spacing: -.01em; }
  .logo-mark { width: 30px; height: 30px; display: block; }
  .logo b { color: var(--acc); font-weight: 700; }
  .gh-link { color: var(--muted); text-decoration: none; font-size: 14.5px; font-weight: 600; border: 1px solid var(--line-2); padding: 10px 18px; border-radius: 999px; transition: color .18s var(--ease), border-color .18s var(--ease), transform .18s var(--ease); touch-action: manipulation; user-select: none; -webkit-user-select: none; }
  @media (hover: hover) and (pointer: fine) {
    .gh-link:hover { color: var(--ink); border-color: var(--acc-line); transform: translateY(-1px); }
  }
  .gh-link:active { transform: scale(.97); }

  .hero { display: grid; grid-template-columns: 1.06fr .94fr; gap: 64px; align-items: start; padding: 44px 0 76px; }
  .eyebrow { display: inline-flex; align-items: center; gap: 9px; font-family: var(--font-m); font-size: 12px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: var(--acc); background: var(--acc-soft); border: 1px solid var(--acc-line); padding: 8px 16px; border-radius: 999px; }
  .eyebrow::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--acc); box-shadow: 0 0 10px var(--acc); }
  .hero h1 { font-size: clamp(42px, 4.8vw, 62px); font-weight: 700; letter-spacing: -.035em; line-height: 1.02; margin: 26px 0 18px; }
  .hero h1 .accent { color: var(--acc); }
  .lede { font-size: 17.5px; color: var(--muted); margin: 0; max-width: 46ch; line-height: 1.6; }

  form#f { display: flex; gap: 12px; margin-top: 30px; }
  #url { flex: 1; min-width: 0; background: var(--surface); border: 1px solid var(--line-2); color: var(--ink); border-radius: 999px; padding: 0 22px; height: 58px; font-size: 16px; font-family: var(--font-m); outline: none; transition: border-color .18s var(--ease), box-shadow .18s var(--ease); }
  #url::placeholder { color: var(--faint); }
  #url:focus { border-color: var(--acc-line); box-shadow: 0 0 0 4px rgba(240,168,50,.14); }

  .cta { display: inline-flex; align-items: center; gap: 12px; background: var(--acc); color: var(--acc-ink); border: none; border-radius: 999px; padding: 8px 8px 8px 26px; height: 58px; font-size: 16.5px; font-weight: 700; font-family: var(--font-d); cursor: pointer; white-space: nowrap; transition: transform .16s var(--ease), background .18s var(--ease), box-shadow .2s var(--ease); touch-action: manipulation; user-select: none; -webkit-user-select: none; }
  .cta-ico { width: 42px; height: 42px; border-radius: 50%; background: rgba(32,19,4,.9); display: grid; place-items: center; transition: transform .2s var(--ease); flex-shrink: 0; }
  .cta-ico svg { width: 18px; height: 18px; fill: var(--acc); margin-left: 2px; }
  @media (hover: hover) and (pointer: fine) {
    .cta:hover { background: var(--acc-hi); box-shadow: 0 10px 34px rgba(240,168,50,.28); }
    .cta:hover .cta-ico { transform: scale(1.08) rotate(-6deg); }
  }
  .cta:active { transform: scale(.97); }
  .cta:disabled { opacity: .55; cursor: default; transform: none; box-shadow: none; }

  .opts { margin-top: 26px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  .opt2 { grid-column: 1 / -1; }
  .opt-label { display: block; font-family: var(--font-m); font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--dim); font-weight: 600; margin-bottom: 10px; }
  .seg { display: flex; background: rgba(239,232,217,.05); border: 1px solid var(--line); border-radius: 999px; padding: 4px; gap: 4px; max-width: 100%; }
  .seg button { flex: 1 1 0; background: transparent; border: none; color: var(--muted); font-size: 14px; font-weight: 600; font-family: var(--font-d); padding: 10px 14px; border-radius: 999px; cursor: pointer; transition: background .16s var(--ease), color .16s var(--ease), transform .16s var(--ease); touch-action: manipulation; user-select: none; -webkit-user-select: none; text-align: left; min-width: 0; }
  .seg button small { display: block; font-size: 11px; font-weight: 500; color: var(--faint); margin-top: 2px; }
  .seg button.on { background: var(--acc-soft); color: var(--acc); box-shadow: inset 0 0 0 1px var(--acc-line); }
  .seg button.on small { color: rgba(240,168,50,.75); }
  @media (hover: hover) and (pointer: fine) { .seg button:hover:not(.on) { color: var(--ink); background: rgba(239,232,217,.06); } }
  .seg button:active { transform: scale(.96); }

  select { width: 100%; appearance: none; -webkit-appearance: none; background-color: rgba(239,232,217,.05); border: 1px solid var(--line-2); color: var(--ink); border-radius: var(--r-md); padding: 13px 42px 13px 16px; font-size: 16px; font-family: var(--font-d); cursor: pointer; outline: none; transition: border-color .18s var(--ease);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23a79b84' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 16px center; background-size: 12px; }
  select:hover, select:focus { border-color: var(--acc-line); }
  select:disabled { opacity: .5; cursor: default; }
  select option { background: #171410; color: var(--ink); }
  .opt-blurb { margin: 10px 0 0; font-size: 13.5px; color: var(--faint); line-height: 1.5; }
  .checks { display: flex; gap: 26px; flex-wrap: wrap; }
  .chk { display: flex; align-items: center; gap: 11px; font-size: 15px; color: var(--ink); cursor: pointer; font-weight: 500; }
  .chk input { width: 19px; height: 19px; accent-color: var(--acc); cursor: pointer; flex-shrink: 0; }
  .chk small { color: var(--faint); font-size: 13px; }

  .hint { color: var(--dim); font-size: 13.5px; margin: 18px 2px 0; font-family: var(--font-m); }
  .hint code { color: var(--muted); background: rgba(239,232,217,.06); padding: 2px 7px; border-radius: 6px; font-size: 12.5px; }
  .err { margin-top: 18px; color: var(--bad); background: rgba(240,154,141,.08); border: 1px solid rgba(240,154,141,.3); border-radius: var(--r-md); padding: 13px 18px; font-size: 15px; display: none; }

  .hero-reel { position: sticky; top: 28px; }
  .reel-frame { background: var(--surface); border: 1px solid var(--line-2); border-radius: 24px; padding: 12px; box-shadow: 0 30px 90px rgba(0,0,0,.5); }
  .reel-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px 12px; }
  .rk { font-family: var(--font-m); font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: var(--acc); font-weight: 600; }
  .tc { font-family: var(--font-m); font-size: 12px; color: var(--dim); font-variant-numeric: tabular-nums; }
  .sprocket { height: 22px; border-radius: 6px; background-color: #060504;
    background-image: radial-gradient(circle at 13px 50%, #2b251c 5.5px, transparent 6.5px);
    background-size: 30px 100%; background-repeat: repeat-x; background-position: 8px 0; }
  .reel-screen { position: relative; display: block; margin: 8px 0; border-radius: 12px; overflow: hidden; aspect-ratio: 16/9; background: #060504; }
  .reel-screen img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .5s var(--ease); }
  @media (hover: hover) and (pointer: fine) { .reel-screen:hover img { transform: scale(1.03); } }
  .reel-play { position: absolute; inset: 0; display: grid; place-items: center; }
  .reel-play span { width: 64px; height: 64px; border-radius: 50%; background: rgba(13,12,10,.72); border: 1px solid var(--acc-line); display: grid; place-items: center; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); transition: transform .22s var(--ease), background .2s var(--ease); }
  .reel-play svg { width: 24px; height: 24px; fill: var(--acc); margin-left: 3px; }
  @media (hover: hover) and (pointer: fine) {
    .reel-screen:hover .reel-play span { transform: scale(1.1); background: rgba(240,168,50,.92); }
    .reel-screen:hover .reel-play svg { fill: var(--acc-ink); }
  }
  .reel-foot { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 12px 10px 8px; }
  .rt { font-weight: 700; font-size: 16px; letter-spacing: -.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rm { font-family: var(--font-m); font-size: 12px; color: var(--dim); white-space: nowrap; }

  .btn2 { display: inline-flex; align-items: center; gap: 8px; background: transparent; border: 1px solid var(--line-2); color: var(--ink); border-radius: 999px; padding: 12px 22px; font-size: 15px; font-weight: 600; font-family: var(--font-d); cursor: pointer; text-decoration: none; transition: border-color .18s var(--ease), color .18s var(--ease), transform .16s var(--ease); touch-action: manipulation; user-select: none; -webkit-user-select: none; white-space: nowrap; }
  @media (hover: hover) and (pointer: fine) { .btn2:hover { border-color: var(--acc-line); color: var(--acc); } }
  .btn2:active { transform: scale(.97); }
  .btn2:disabled { opacity: .5; cursor: default; transform: none; }
  .btn2.sm { padding: 8px 15px; font-size: 13px; }
  .btn2.danger:hover { border-color: rgba(240,154,141,.5); color: var(--bad); }

  .toolcard { display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 24px 28px; margin: 0 0 8px; }
  .toolcard .tt { font-weight: 700; font-size: 17px; letter-spacing: -.01em; }
  .toolcard .tt::before { content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--acc); margin-right: 10px; }
  .toolcard .td { color: var(--muted); font-size: 14.5px; margin-top: 6px; line-height: 1.55; max-width: 560px; }

  .panel { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 34px; display: none; margin-top: 8px; }
  .panel h2 { margin: 0 0 8px; font-size: 24px; font-weight: 700; letter-spacing: -.02em; }
  .panel .sub { color: var(--muted); margin-bottom: 26px; word-break: break-all; font-family: var(--font-m); font-size: 13.5px; }
  .steps { display: flex; flex-direction: column; gap: 4px; }
  .step { display: flex; align-items: center; gap: 16px; color: var(--faint); font-size: 16px; padding: 9px 0; transition: color .3s var(--ease); }
  .step .ico { width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid var(--line-2); display: grid; place-items: center; font-size: 13px; font-family: var(--font-m); font-weight: 600; flex-shrink: 0; transition: border-color .3s var(--ease), color .3s var(--ease), background .3s var(--ease); }
  .step.active { color: var(--ink); }
  .step.active .ico { border-color: var(--acc); color: var(--acc); animation: pulse 1.6s var(--ease) infinite; }
  .step.done { color: var(--muted); }
  .step.done .ico { border-color: var(--ok); color: var(--ok); background: rgba(123,217,154,.08); }
  .step.hidden { display: none; }
  @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(240,168,50,.28); } 50% { box-shadow: 0 0 0 8px rgba(240,168,50,0); } }
  .bar { height: 8px; border-radius: 999px; background: rgba(239,232,217,.08); margin-top: 24px; overflow: hidden; display: none; }
  .bar i { display: block; height: 100%; width: 0; background: var(--acc); border-radius: 999px; transition: width .6s var(--ease); }
  .queue-note { margin-top: 18px; font-size: 14px; color: var(--faint); display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }

  .review { display: none; margin-top: 8px; }
  .review h2 { font-size: 28px; margin: 0 0 8px; letter-spacing: -.025em; font-weight: 700; }
  .review .lead { color: var(--muted); font-size: 15.5px; margin: 0 0 26px; line-height: 1.6; max-width: 62ch; }
  #warnings { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
  #warnings:empty { margin-bottom: 0; }
  .warn { color: #f4cf8e; background: rgba(240,168,50,.07); border: 1px solid rgba(240,168,50,.3); border-radius: var(--r-sm); padding: 11px 16px; font-size: 14px; line-height: 1.5; }
  .field { display: flex; flex-direction: column; gap: 7px; margin-bottom: 16px; }
  .field > label { font-family: var(--font-m); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--dim); font-weight: 600; }
  .field input, .field textarea { width: 100%; font-size: 15.5px; padding: 12px 15px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid var(--line-2); color: var(--ink); font-family: var(--font-d); outline: none; transition: border-color .18s var(--ease), box-shadow .18s var(--ease); }
  .field input:focus, .field textarea:focus { border-color: var(--acc-line); box-shadow: 0 0 0 4px rgba(240,168,50,.12); }
  .field textarea { resize: vertical; min-height: 76px; line-height: 1.5; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .scene-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 26px 28px; margin-top: 18px; }
  .scene-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; gap: 12px; flex-wrap: wrap; }
  .scene-head .n { font-weight: 700; font-size: 17px; letter-spacing: -.01em; display: inline-flex; align-items: center; }
  .kind { font-family: var(--font-m); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--acc); background: var(--acc-soft); border: 1px solid var(--acc-line); padding: 5px 12px; border-radius: 999px; font-weight: 600; margin-left: 12px; }
  .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .stat-pair { display: flex; gap: 8px; }
  .stat-pair input { flex: 1; min-width: 0; background: var(--surface-2); border: 1px solid var(--line-2); color: var(--ink); border-radius: var(--r-sm); padding: 11px 13px; font-size: 15px; font-family: var(--font-d); outline: none; }
  .stat-pair input:focus { border-color: var(--acc-line); }
  .words { font-size: 12.5px; color: var(--dim); text-align: right; font-family: var(--font-m); }
  .rewrite { display: flex; gap: 10px; margin-top: 14px; align-items: center; }
  .rewrite input { flex: 1; font-size: 14px; padding: 10px 14px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid var(--line-2); color: var(--ink); font-family: var(--font-d); outline: none; min-width: 0; }
  .rewrite input:focus { border-color: var(--acc-line); }
  .review-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 26px; flex-wrap: wrap; align-items: center; }
  .review-actions .spacer { flex: 1; color: var(--faint); font-size: 13.5px; }

  .player { display: none; margin-top: 8px; }
  .player .frame { background: var(--surface); border: 1px solid var(--line); border-radius: 24px; padding: 12px; box-shadow: 0 30px 90px rgba(0,0,0,.5); }
  .player video { display: block; margin: 0 auto; width: 100%; border-radius: 12px; background: #000; }
  .player.fmt-vertical video { width: min(100%, 400px); }
  .player.fmt-square video { width: min(100%, 620px); }
  .player .meta { text-align: center; color: var(--dim); font-size: 13.5px; margin-top: 16px; font-family: var(--font-m); }
  .player .meta b { color: var(--muted); font-weight: 600; }
  .player .actions { display: flex; gap: 12px; justify-content: center; margin-top: 20px; flex-wrap: wrap; }
  .banner { margin: 18px auto 0; max-width: 860px; background: var(--acc-soft); border: 1px solid var(--acc-line); border-radius: var(--r-md); padding: 13px 20px; font-size: 14.5px; color: var(--ink); display: none; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }

  .msg { margin: 40px auto 0; text-align: center; display: none; max-width: 640px; }
  .msg h2 { font-size: 26px; margin: 0 0 10px; letter-spacing: -.02em; }
  .msg p { color: var(--muted); margin: 0 0 24px; }

  .examples { margin-top: 88px; padding-bottom: 8px; }
  .ex-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 22px; flex-wrap: wrap; }
  .ex-head h2 { font-size: clamp(26px, 3vw, 34px); font-weight: 700; letter-spacing: -.025em; margin: 0; }
  .ex-sub { color: var(--dim); font-size: 14.5px; margin: 0; font-family: var(--font-m); }
  .film { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 18px 0; }
  .strip { display: flex; gap: 22px; overflow-x: auto; scroll-snap-type: x proximity; padding: 6px 2px 14px; scrollbar-width: thin; scrollbar-color: var(--line-2) transparent; }
  .card { display: block; flex: 0 0 300px; scroll-snap-align: start; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; text-decoration: none; color: var(--ink); transition: transform .2s var(--ease), border-color .2s var(--ease); }
  @media (hover: hover) and (pointer: fine) { .card:hover { transform: translateY(-4px); border-color: var(--acc-line); } }
  .card:active { transform: scale(.98); }
  .card .thumb { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; background: #060504; }
  .card.fmt-vertical { flex-basis: 220px; }
  .card.fmt-vertical .thumb { aspect-ratio: 9/16; max-height: 380px; }
  .card.fmt-square .thumb { aspect-ratio: 1/1; }
  .card .meta { padding: 14px 17px 16px; }
  .card .t { font-weight: 700; font-size: 15.5px; letter-spacing: -.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .card .c { color: var(--dim); font-size: 12.5px; margin-top: 6px; display: flex; justify-content: space-between; gap: 8px; font-family: var(--font-m); }
  .card .cc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  footer { position: relative; z-index: 1; border-top: 1px solid var(--line); margin-top: 88px; padding: 36px 24px 60px; text-align: center; color: var(--faint); font-size: 13px; line-height: 1.9; font-family: var(--font-m); }
  footer a { color: var(--muted); transition: color .18s var(--ease); }
  footer a:hover { color: var(--acc); }
  footer p { margin: 0 0 8px; }

  @media (max-width: 960px) {
    .hero { grid-template-columns: 1fr; gap: 48px; padding-top: 24px; }
    .hero-reel { position: static; max-width: 560px; }
    .opts { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    form#f { flex-direction: column; }
    .cta { justify-content: space-between; padding-left: 24px; }
    .row2 { grid-template-columns: 1fr; }
    .stats-grid { grid-template-columns: 1fr; }
    .nav { padding: 20px 0; }
    .hero h1 { font-size: 40px; }
    .scene-card { padding: 20px; }
    .panel { padding: 24px 20px; }
  }

</style>
</head>
<body>
<div class="grain" aria-hidden="true"></div>
<div class="glow" aria-hidden="true"></div>
<main class="wrap">
  <header class="nav rise" style="--i:0">
    <a class="logo" href="/" aria-label="RepoReel home">
      <svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#f0a832"/><path d="M12.5 10.5v11l9.5-5.5z" fill="#201304"/></svg>
      <span>Repo<b>Reel</b></span>
    </a>
    <a class="gh-link" href="https://github.com/marlandoj/reporeel" target="_blank" rel="noopener">Source on GitHub</a>
  </header>
  <section class="hero" id="hero">
    <div class="hero-copy">
      <span class="eyebrow rise" id="noacct" style="--i:1">No accounts &middot; no sign-up &middot; no email</span>
      <h1 class="rise" id="h1" style="--i:2">Paste a repo.<br /><span class="accent">Get a movie.</span></h1>
      <p class="lede rise" id="lede" style="--i:3">Paste a GitHub link and get a short narrated explainer video, with a script review before every render.</p>
      <form class="rise" id="f" style="--i:4">
        <input id="url" type="text" placeholder="https://github.com/owner/repo" autocomplete="off" spellcheck="false" autocapitalize="none" aria-label="GitHub repository URL" required />
        <button class="cta" id="go" type="submit"><span>Make the reel</span><span class="cta-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span></button>
      </form>
      <div class="opts rise" id="opts" style="--i:5">
        <div class="opt">
          <span class="opt-label" id="lbl-grounding">Ground the story in</span>
          <div class="seg" role="group" aria-labelledby="lbl-grounding" data-name="grounding">
            <button type="button" data-v="readme" aria-pressed="false">README</button>
            <button type="button" data-v="code" aria-pressed="false">Code</button>
            <button type="button" data-v="both" class="on" aria-pressed="true">Both</button>
          </div>
        </div>
        <div class="opt">
          <span class="opt-label" id="lbl-format">Format</span>
          <div class="seg" role="group" aria-labelledby="lbl-format" data-name="format">
            <button type="button" data-v="landscape" class="on" aria-pressed="true">16:9<small>YouTube &middot; X &middot; LinkedIn</small></button>
            <button type="button" data-v="vertical" aria-pressed="false">9:16<small>Shorts &middot; Reels &middot; TikTok</small></button>
            <button type="button" data-v="square" aria-pressed="false">1:1<small>Feeds</small></button>
          </div>
        </div>
        <div class="opt opt2">
          <label class="opt-label" for="renderer">Animation</label>
          <select id="renderer"><option value="hyperframes">Hyperframes styles</option><option value="huashu-keynote">Huashu Keynote</option></select>
        </div>
        <div class="opt opt2">
          <label class="opt-label" for="style">Visual style</label>
          <select id="style">
            <option value="studio" selected>Studio: neon dark, technical, the RepoReel default</option>
            <option value="3b1b">3b1b: black canvas, drawn diagrams, one idea at a time</option>
            <option value="eli5">ELI5: warm paper, big friendly type, everyday analogies</option>
            <option value="whiteboard">Whiteboard: hand-drawn ink, sticky notes, sketch reveals</option>
            <option value="terminal">Terminal: monospace phosphor green, typed-in output</option>
            <option value="diff">Diff: PR review look, file headers, green/red hunk rows</option>
            <option value="graph">Graph: commit timeline, branch lanes, tag pills</option>
          </select>
          <p class="opt-blurb" id="style-blurb">The style picks the look, the motion, and the voice the narrator writes in.</p>
        </div>
        <div class="opt opt2 checks">
          <label class="chk"><input type="checkbox" id="captions" /><span>Burned-in captions <small>+ SRT file</small></span></label>
          <label class="chk"><input type="checkbox" id="plain" /><span>Plain language <small>ASD-STE100 Simplified Technical English</small></span></label>
          <label class="chk"><input type="checkbox" id="review" checked /><span>Review the script before rendering</span></label>
        </div>
      </div>
      <p class="hint rise" id="hint" style="--i:6">Works with repo, pull request, release, and compare URLs. Try <code>owner/repo@v1.2.0</code> for a changelog reel.</p>
      <div class="err" id="err" role="alert"></div>
    </div>
    <aside class="hero-reel rise" style="--i:4">
      <div class="reel-frame">
        <div class="reel-head">
          <span class="rk">Now showing</span>
          <span class="tc" id="hero-tc">TC 00:00:00:00</span>
        </div>
        <div class="sprocket" aria-hidden="true"></div>
        <a class="reel-screen" id="hero-reel-link" href="#examples" aria-label="Latest example reel">
          <img id="hero-reel-img" src="/og.png" alt="RepoReel example output" />
          <span class="reel-play" aria-hidden="true"><span><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span></span>
        </a>
        <div class="sprocket" aria-hidden="true"></div>
        <div class="reel-foot">
          <span class="rt" id="hero-reel-title">RepoReel</span>
          <span class="rm" id="hero-reel-meta">16:9</span>
        </div>
      </div>
    </aside>
  </section>
  <section class="toolcard rise" id="toolcard" style="--i:0">
    <div>
      <div class="tt">Plain-language writer</div>
      <div class="td">Rewrite any text in ASD-STE100 Simplified Technical English, with a rule-by-rule report you can download. Free, no account.</div>
    </div>
    <a class="btn2" href="/ste100">Open the writer</a>
  </section>
  <section class="panel" id="panel">
    <h2 id="p-title">Building your reel</h2>
    <div class="sub" id="p-sub"></div>
    <div class="steps" id="steps">
      <div class="step" data-s="queued"><span class="ico">1</span> Queued</div>
      <div class="step" data-s="ingesting"><span class="ico">2</span> Reading the repository</div>
      <div class="step" data-s="scripting"><span class="ico">3</span> Writing the script</div>
      <div class="step" data-s="review"><span class="ico">4</span> Script review</div>
      <div class="step" data-s="voicing"><span class="ico">5</span> Recording narration</div>
      <div class="step" data-s="rendering"><span class="ico">6</span> Rendering the video</div>
    </div>
    <div class="bar" id="bar"><i id="bar-fill"></i></div>
    <div class="queue-note"><span id="q-note"></span><button class="btn2 sm danger" id="cancel" style="display:none">Cancel</button></div>
  </section>
  <section class="review" id="review-panel">
    <h2>Review the script</h2>
    <p class="lead" id="review-lead">Edit anything on screen or in the narration, rewrite a scene with a note, then render. Nothing is rendered until you say so.</p>
    <div id="warnings"></div>
    <div class="row2">
      <div class="field"><label>Title</label><input id="ed-title" type="text" maxlength="80" /></div>
      <div class="field"><label>Tagline</label><input id="ed-tagline" type="text" maxlength="120" /></div>
    </div>
    <div id="scenes"></div>
    <div class="review-actions">
      <span class="spacer" id="review-status"></span>
      <button class="btn2 danger" id="review-cancel">Discard</button>
      <button class="btn2" id="review-save">Save draft</button>
      <button class="cta" id="review-render">Render the reel</button>
    </div>
  </section>
  <section class="player" id="player">
    <div class="frame"><video id="vid" controls playsinline></video></div>
    <div class="meta" id="v-meta"></div>
    <div class="actions">
      <button class="btn2" id="copy">Copy link</button>
      <a class="btn2" id="dl" download>Download MP4</a>
      <a class="btn2" id="dl-srt" download style="display:none">Download SRT</a>
      <button class="btn2" id="refresh">Check for updates</button>
      <a class="btn2" href="/">New reel</a>
    </div>
    <div class="banner" id="banner"><span id="banner-text"></span><button class="btn2 sm" id="banner-btn"></button></div>
  </section>
  <section class="msg" id="msg">
    <h2 id="msg-h"></h2>
    <p id="msg-p"></p>
    <div class="actions" style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><button class="btn2" id="msg-btn" style="display:none"></button><a class="btn2" href="/">New reel</a></div>
  </section>
  <section class="examples" id="examples" style="display:none">
    <div class="ex-head">
      <h2>Fresh from the reel</h2>
      <p class="ex-sub">Rendered on this server</p>
    </div>
    <div class="film"><div class="strip" id="grid"></div></div>
  </section>
</main>
<footer>
  <p>Built solo in 48 hours for <a href="https://hackyard.tech" target="_blank" rel="noopener">Hackyard Yard #1</a> (2nd place). Theme: no accounts.</p>
  <p>Also: the <a href="/ste100">plain-language writer</a> (ASD-STE100) for operators.<br />
  Open source at <a href="https://github.com/marlandoj/reporeel" target="_blank" rel="noopener">github.com/marlandoj/reporeel</a>. Videos are AI-generated from public repo data.<br />
  Reels are automatically deleted 48 hours after rendering.</p>
</footer>
<script>
(function () {
  var tc = document.getElementById("hero-tc");
  var t0 = Date.now();
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function tick() {
    var el = Date.now() - t0;
    var s = Math.floor(el / 1000);
    var f = Math.floor((el % 1000) / 1000 * 24);
    tc.textContent = "TC " + pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60) + ":" + pad(f);
  }
  if (tc && !reduced) setInterval(tick, 1000 / 24);
  function syncPressed(seg) {
    seg.querySelectorAll("button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.classList.contains("on") ? "true" : "false");
    });
  }
  document.querySelectorAll(".seg").forEach(function (seg) {
    syncPressed(seg);
    seg.addEventListener("click", function () { syncPressed(seg); });
  });
  fetch("/api/examples", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.json(); })
    .then(function (list) {
      if (!list || !list.length) return;
      var x = list[0];
      var img = document.getElementById("hero-reel-img");
      var link = document.getElementById("hero-reel-link");
      var label = x.title || x.canonical || "Example reel";
      if (img) { img.src = x.poster ? "/posters/" + x.id + ".jpg" : "/og.png"; img.alt = label; }
      if (link) { link.href = "/v/" + x.id; link.setAttribute("aria-label", "Watch: " + label); }
      var t = document.getElementById("hero-reel-title");
      if (t) t.textContent = label;
      var m = document.getElementById("hero-reel-meta");
      if (m) m.textContent = [x.format === "vertical" ? "9:16" : x.format === "square" ? "1:1" : "16:9", (x.views === 1 ? "1 view" : (x.views || 0) + " views")].join("  \u00b7  ");
    })
    .catch(function () {});
})();
</script>
<script>
(function () {
  var JOB = ${jobId ? JSON.stringify(jobId) : "null"};
  var ORDER = ["queued", "ingesting", "scripting", "review", "voicing", "rendering"];
  var FORMAT_LABEL = { landscape: "16:9 landscape", vertical: "9:16 vertical", square: "1:1 square" };
  var STYLE_META = ${STYLE_JSON};
  function $(id) { return document.getElementById(id); }
  var state = { id: null, job: null, script: null, pollTimer: null, editorOpen: false, cachedNotice: false, captionsTouched: false };
  var opts = { renderer: "hyperframes", grounding: "both", format: "landscape", style: "studio", plain: false, captions: false, review: true };
  var huashuOK = true;
  var STYLE_META = ${STYLE_JSON};
  try {
    var saved = JSON.parse(localStorage.getItem("rr-opts") || "null");
    if (saved && saved.renderer === "huashu-keynote") opts.renderer = saved.renderer;
    if (saved && saved.style) opts.style = saved.style;
    if (saved && saved.plain != null) opts.plain = !!saved.plain;
  } catch (e) {}
  function persistOpts() { try { localStorage.setItem("rr-opts", JSON.stringify({ renderer: opts.renderer, style: opts.style, plain: opts.plain })); } catch (e) {} }
  fetch("/healthz", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.json(); })
    .then(function (h) { huashuOK = !!(h && h.huashu); applyStyleSelect(); })
    .catch(function () {});
  function applyStyleSelect() {
    var sel = $("style");
    var rsel = $("renderer");
    var hopt = rsel.querySelector('option[value="huashu-keynote"]');
    if (hopt) {
      hopt.disabled = !huashuOK;
      hopt.textContent = huashuOK ? "Huashu Keynote" : "Huashu Keynote (unavailable on this server)";
    }
    if (!huashuOK && opts.renderer === "huashu-keynote") opts.renderer = "hyperframes";
    rsel.value = opts.renderer;
    sel.disabled = opts.renderer === "huashu-keynote";
    sel.value = opts.style;
    $("plain").checked = opts.plain;
    var meta = STYLE_META[opts.style];
    if (opts.renderer === "huashu-keynote") { $("style-blurb").textContent = "Animated Keynote titles and feature cards, timed to your narration."; return; }
    if (meta) $("style-blurb").textContent = meta.blurb + (opts.plain ? " Plain language is on, so the script also follows ASD-STE100." : "");
  }

  function ownerToken(id) { try { return localStorage.getItem("rr-owner-" + id) || ""; } catch (e) { return ""; } }
  function saveOwner(id, t) { try { localStorage.setItem("rr-owner-" + id, t); } catch (e) {} }
  function api(path, method, body) {
    var h = { Accept: "application/json" };
    if (body) h["Content-Type"] = "application/json";
    var t = state.id ? ownerToken(state.id) : "";
    if (t) h["X-Owner-Token"] = t;
    return fetch(path, { method: method || "GET", headers: h, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); });
  }
  function showErr(m) { $("err").textContent = m; $("err").style.display = "block"; }
  function hideErr() { $("err").style.display = "none"; }
  function stopPoll() { if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; } }
  function fmtEta(s) { if (s == null) return ""; if (s < 60) return "about " + s + "s left"; return "about " + Math.ceil(s / 60) + " min left"; }

  function show(which) {
    ["panel", "review-panel", "player", "msg"].forEach(function (id) { $(id).style.display = id === which ? "block" : "none"; });
    var compact = which !== null;
    $("f").style.display = compact ? "none" : "";
    $("opts").style.display = compact ? "none" : "";
    $("hint").style.display = compact ? "none" : "";
    $("lede").style.display = compact ? "none" : "";
    $("noacct").style.display = compact ? "none" : "";
    $("toolcard").style.display = compact ? "none" : "flex";
    $("h1").style.fontSize = compact ? "34px" : "";
    $("examples").style.display = compact ? "none" : $("examples").style.display;
  }

  document.querySelectorAll(".seg").forEach(function (seg) {
    seg.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        seg.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        var name = seg.getAttribute("data-name");
        opts[name] = b.getAttribute("data-v");
        if (name === "format" && !state.captionsTouched) {
          opts.captions = opts.format !== "landscape";
          $("captions").checked = opts.captions;
        }
      });
    });
  });
  $("captions").addEventListener("change", function () { state.captionsTouched = true; opts.captions = this.checked; });
  $("review").addEventListener("change", function () { opts.review = this.checked; });
  $("renderer").addEventListener("change", function () { opts.renderer = this.value; if (opts.renderer === "huashu-keynote") opts.style = "studio"; applyStyleSelect(); persistOpts(); });
  $("style").addEventListener("change", function () { opts.style = this.value; applyStyleSelect(); persistOpts(); });
  $("plain").addEventListener("change", function () { opts.plain = this.checked; applyStyleSelect(); persistOpts(); });
  applyStyleSelect();

  function setStage(status, reviewEnabled) {
    var idx = ORDER.indexOf(status);
    document.querySelectorAll(".step").forEach(function (el, i) {
      el.classList.remove("active", "done");
      var s = el.getAttribute("data-s");
      if (s === "review") el.classList.toggle("hidden", !reviewEnabled);
      if (i < idx) el.classList.add("done");
      if (i === idx) el.classList.add("active");
      if (status === "done") el.classList.add("done");
    });
  }

  function showPanel(j) {
    show("panel");
    $("p-sub").textContent = j.url || "";
    setStage(j.status, j.options && j.options.review);
    var note = "";
    var bar = $("bar");
    bar.style.display = "none";
    if (j.status === "queued" && j.position > 0) note = j.position + " ahead of you in the queue.";
    else if (j.status === "ingesting") note = "Reading " + (j.options ? j.options.grounding === "both" ? "the README and the source tree" : j.options.grounding === "code" ? "the source tree, manifest, and entry file" : "the README" : "the repo") + ".";
    else if (j.status === "scripting") note = "Drafting six scenes and checking every number against the repo data.";
    else if (j.status === "review") note = "The person who started this reel is reviewing the script.";
    else if (j.status === "voicing") note = "Synthesizing narration locally, one scene at a time.";
    else if (j.status === "rendering") {
      if (j.progress && j.progress.total) {
        bar.style.display = "block";
        $("bar-fill").style.width = Math.round((j.progress.done / j.progress.total) * 100) + "%";
        note = "Frame " + j.progress.done + " of " + j.progress.total + (j.progress.etaSeconds != null ? " · " + fmtEta(j.progress.etaSeconds) : "");
      } else {
        note = "Starting the renderer. This page updates itself.";
      }
    }
    $("q-note").textContent = note;
    $("cancel").style.display = j.cancellable ? "" : "none";
  }

  function showMessage(h, p, btnLabel, onBtn) {
    show("msg");
    $("msg-h").textContent = h;
    $("msg-p").textContent = p;
    var b = $("msg-btn");
    if (btnLabel) { b.style.display = ""; b.textContent = btnLabel; b.onclick = onBtn; } else { b.style.display = "none"; }
  }

  function showPlayer(j) {
    show("player");
    var player = $("player");
    player.className = "player fmt-" + (j.format ? j.format.key : "landscape");
    var v = $("vid");
    if (v.getAttribute("src") !== "/videos/" + j.id + ".mp4") v.src = "/videos/" + j.id + ".mp4";
    if (j.poster) v.poster = "/posters/" + j.id + ".jpg";
    $("dl").href = "/videos/" + j.id + ".mp4";
    $("dl").setAttribute("download", (j.title || j.id).replace(/[^\\w.-]+/g, "-") + ".mp4");
    $("dl-srt").style.display = j.captions ? "" : "none";
    $("dl-srt").href = "/videos/" + j.id + ".srt";
    document.title = (j.title || "Your reel") + " — RepoReel";
    var meta = [];
    if (j.format) meta.push("<b>" + FORMAT_LABEL[j.format.key] + "</b>");
    if (j.options) meta.push("grounded in " + (j.options.grounding === "both" ? "README + code" : j.options.grounding));
    var stMeta = j.options ? STYLE_META[j.options.style] : null;
    if (j.options && j.options.renderer === "huashu-keynote") meta.push("Huashu Keynote");
    else if (stMeta) meta.push(stMeta.label.toLowerCase() + " style");
    if (j.options && j.options.plain) meta.push("plain language");
    if (j.captions) meta.push("captions");
    if (j.total) meta.push(Math.round(j.total) + "s");
    meta.push(j.views === 1 ? "1 view" : (j.views || 0) + " views");
    $("v-meta").innerHTML = meta.join(" · ");
    $("copy").onclick = function () {
      navigator.clipboard.writeText(location.origin + "/v/" + j.id);
      this.textContent = "Copied";
      var b = this; setTimeout(function () { b.textContent = "Copy link"; }, 1600);
    };
    var banner = $("banner");
    banner.style.display = "none";
    if (state.cachedNotice) {
      state.cachedNotice = false;
      banner.style.display = "flex";
      $("banner-text").textContent = "This reel already existed in this format, so here it is instantly.";
      $("banner-btn").textContent = "Make a fresh one";
      $("banner-btn").onclick = function () { submit(j.url, j.options, true); };
    }
    $("refresh").onclick = function () {
      var btn = this;
      btn.disabled = true; btn.textContent = "Checking…";
      api("/api/jobs/" + j.id + "/refresh", "POST", {}).then(function (res) {
        btn.disabled = false; btn.textContent = "Check for updates";
        if (!res.ok) { showErr(res.j.error || "Could not check GitHub."); return; }
        banner.style.display = "flex";
        if (res.j.stale) {
          $("banner-text").textContent = "The repo has changed since this reel was made" + (res.j.pushedAt ? " (last push " + res.j.pushedAt.slice(0, 10) + ")" : "") + ".";
          $("banner-btn").textContent = "Re-render";
          $("banner-btn").onclick = function () {
            api("/api/jobs/" + j.id + "/refresh", "POST", { force: true }).then(function (r2) {
              if (!r2.ok) { showErr(r2.j.error || "Could not start a re-render."); return; }
              if (r2.j.ownerToken) saveOwner(r2.j.id, r2.j.ownerToken);
              history.pushState({}, "", "/v/" + r2.j.id);
              watch(r2.j.id);
            });
          };
        } else {
          $("banner-text").textContent = "Up to date. No new pushes since this reel was rendered.";
          $("banner-btn").textContent = "Re-render anyway";
          $("banner-btn").onclick = function () { submit(j.url, j.options, true); };
        }
      });
    };
  }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function wordCount(s) { return (s.trim().match(/\\S+/g) || []).length; }
  function sceneWarnings(warnings, i) {
    var prefix = "Scene " + (i + 1) + ":";
    return warnings.filter(function (w) { return w.indexOf(prefix) === 0; }).map(function (w) { return w.slice(prefix.length).trim(); });
  }

  function renderEditor(rs) {
    var script = rs.script;
    state.script = script;
    $("ed-title").value = script.title || "";
    $("ed-tagline").value = script.tagline || "";
    var warnBox = $("warnings");
    warnBox.innerHTML = "";
    var general = rs.warnings.filter(function (w) { return !/^Scene \\d+:/.test(w); });
    if (rs.warnings.length) {
      var w = el("div", "warn");
      w.textContent = rs.warnings.length + " " + (rs.warnings.length === 1 ? "check" : "checks") + " to fix: every finding below is flagged on the scene it came from. Numbers and code lines must match the repo data, and the plain-language pass follows ASD-STE100. Edit them or rewrite the scene.";
      warnBox.appendChild(w);
      general.forEach(function (g) { warnBox.appendChild(el("div", "warn", g)); });
    }
    var wrap = $("scenes");
    wrap.innerHTML = "";
    script.scenes.forEach(function (s, i) {
      var card = el("div", "scene-card");
      var head = el("div", "scene-head");
      var n = el("span", "n", "Scene " + (i + 1));
      n.appendChild(el("span", "kind", s.kind));
      head.appendChild(n);
      var rw = el("button", "btn2 sm", "Rewrite with AI");
      rw.type = "button";
      head.appendChild(rw);
      card.appendChild(head);
      var fh = el("div", "field"); fh.appendChild(el("label", null, s.kind === "title" ? "Eyebrow" : "Heading"));
      var ih = el("input"); ih.type = "text"; ih.maxLength = 80; ih.value = s.heading || ""; ih.setAttribute("data-f", "heading"); fh.appendChild(ih); card.appendChild(fh);
      if (s.kind === "stats") {
        var fs = el("div", "field"); fs.appendChild(el("label", null, "Stats (value and label)"));
        var grid = el("div", "stats-grid");
        for (var k = 0; k < 4; k++) {
          var pair = el("div", "stat-pair");
          var iv = el("input"); iv.type = "text"; iv.placeholder = "12.4k"; iv.maxLength = 16; iv.setAttribute("data-stat-v", String(k));
          var il = el("input"); il.type = "text"; il.placeholder = "stars"; il.maxLength = 28; il.setAttribute("data-stat-l", String(k));
          if (s.stats && s.stats[k]) { iv.value = s.stats[k].value; il.value = s.stats[k].label; }
          pair.appendChild(iv); pair.appendChild(il); grid.appendChild(pair);
        }
        fs.appendChild(grid); card.appendChild(fs);
      } else {
        var fl = el("div", "field"); fl.appendChild(el("label", null, s.kind === "title" ? "Title, then tagline (one per line)" : s.kind === "outro" ? "Link line" : "On-screen lines (one per line, up to 3)"));
        var tl = el("textarea"); tl.rows = 3; tl.value = (s.lines || []).join("\\n"); tl.setAttribute("data-f", "lines"); fl.appendChild(tl); card.appendChild(fl);
      }
      var fn = el("div", "field"); fn.appendChild(el("label", null, "Narration"));
      var tn = el("textarea"); tn.rows = 3; tn.value = s.narration || ""; tn.setAttribute("data-f", "narration"); fn.appendChild(tn);
      var wc = el("div", "words", wordCount(tn.value) + " words · aim for 12 to 22");
      tn.addEventListener("input", function () { wc.textContent = wordCount(tn.value) + " words · aim for 12 to 22"; });
      fn.appendChild(wc); card.appendChild(fn);
      sceneWarnings(rs.warnings, i).forEach(function (w) { card.appendChild(el("div", "warn", w)); });
      var rrow = el("div", "rewrite");
      var hint = el("input"); hint.type = "text"; hint.placeholder = "Optional note for the rewrite, e.g. mention the CLI, shorter, more concrete"; hint.maxLength = 300;
      rrow.appendChild(hint);
      rrow.style.display = "none";
      card.appendChild(rrow);
      rw.onclick = function () {
        if (rrow.style.display === "none") { rrow.style.display = "flex"; hint.focus(); rw.textContent = "Rewrite now"; return; }
        rw.disabled = true; rw.textContent = "Rewriting…";
        saveDraft(true).then(function () {
          return api("/api/jobs/" + state.id + "/scenes/" + i + "/regenerate", "POST", { hint: hint.value });
        }).then(function (res) {
          if (!res.ok) { showErr(res.j.error || "Rewrite failed."); rw.disabled = false; rw.textContent = "Rewrite with AI"; return; }
          hideErr();
          renderEditor(res.j);
        });
      };
      wrap.appendChild(card);
    });
    $("review-status").textContent = rs.rewritesLeft != null ? rs.rewritesLeft + " AI rewrites left for this reel" : "";
  }

  function collectScript() {
    var cards = $("scenes").querySelectorAll(".scene-card");
    var scenes = [];
    cards.forEach(function (card, i) {
      var base = state.script.scenes[i];
      var s = { kind: base.kind, heading: card.querySelector('[data-f="heading"]').value, narration: card.querySelector('[data-f="narration"]').value };
      var linesEl = card.querySelector('[data-f="lines"]');
      if (linesEl) s.lines = linesEl.value.split("\\n").map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 4);
      if (base.kind === "stats") {
        s.stats = [];
        for (var k = 0; k < 4; k++) {
          var v = card.querySelector('[data-stat-v="' + k + '"]').value.trim();
          var l = card.querySelector('[data-stat-l="' + k + '"]').value.trim();
          if (v && l) s.stats.push({ value: v, label: l });
        }
      }
      scenes.push(s);
    });
    return { title: $("ed-title").value, tagline: $("ed-tagline").value, scenes: scenes };
  }

  function saveDraft(quiet) {
    return api("/api/jobs/" + state.id + "/script", "PUT", collectScript()).then(function (res) {
      if (!res.ok) { showErr(res.j.error || "Could not save."); throw new Error("save failed"); }
      hideErr();
      if (!quiet) renderEditor(res.j);
      else state.script = res.j.script;
      return res.j;
    });
  }

  function openEditor() {
    if (state.editorOpen) return;
    state.editorOpen = true;
    api("/api/jobs/" + state.id + "/script").then(function (res) {
      if (!res.ok) { state.editorOpen = false; showErr(res.j.error || "Could not load the script."); return; }
      renderEditor(res.j);
      show("review-panel");
      $("h1").textContent = "Your script is ready.";
    });
  }
  $("review-save").onclick = function () {
    var b = this; b.disabled = true; b.textContent = "Saving…";
    saveDraft(false).then(function () { b.textContent = "Saved"; setTimeout(function () { b.disabled = false; b.textContent = "Save draft"; }, 1200); })
      .catch(function () { b.disabled = false; b.textContent = "Save draft"; });
  };
  $("review-render").onclick = function () {
    var b = this; b.disabled = true;
    saveDraft(true).then(function () { return api("/api/jobs/" + state.id + "/render", "POST", {}); })
      .then(function (res) {
        b.disabled = false;
        if (!res.ok) { showErr(res.j.error || "Could not start the render."); return; }
        state.editorOpen = false;
        $("h1").innerHTML = 'Rendering.<br /><span class="accent">Hold tight.</span>';
        startPoll();
      })
      .catch(function () { b.disabled = false; });
  };
  function cancelJob() {
    api("/api/jobs/" + state.id + "/cancel", "POST", {}).then(function (res) {
      if (!res.ok) { showErr(res.j.error || "Could not cancel."); return; }
      stopPoll();
      state.editorOpen = false;
      showMessage("Cancelled", "Nothing was rendered and the job files were removed.");
    });
  }
  $("review-cancel").onclick = function () { if (confirm("Discard this script and cancel the reel?")) cancelJob(); };
  $("cancel").onclick = function () { if (confirm("Cancel this reel?")) cancelJob(); };

  function onJob(j) {
    state.job = j;
    if (j.status === "error") {
      stopPoll();
      show(null);
      $("url").value = j.url || "";
      showErr(j.error || "Something went wrong.");
      return;
    }
    if (j.status === "done") { stopPoll(); showPlayer(j); return; }
    if (j.status === "cancelled") { stopPoll(); showMessage("Cancelled", "This reel was cancelled before it rendered."); return; }
    if (j.status === "expired") {
      stopPoll();
      showMessage("This reel expired", "Reels are kept for a limited time. You can render it again with the same settings.", "Render it again", function () { submit(j.url, j.options, false); });
      return;
    }
    if (j.status === "review") {
      if (j.owner) { stopPoll(); openEditor(); } else showPanel(j);
      return;
    }
    showPanel(j);
  }

  function poll() {
    api("/api/jobs/" + state.id).then(function (res) {
      if (!res.ok) { if (res.status === 404) { stopPoll(); showMessage("Not found", "No reel with that id."); } return; }
      onJob(res.j);
    }).catch(function () {});
  }
  function startPoll() { stopPoll(); poll(); state.pollTimer = setInterval(poll, 2500); }

  function watch(id) {
    hideErr();
    state.id = id;
    state.editorOpen = false;
    show("panel");
    setStage("queued", true);
    $("q-note").textContent = "";
    startPoll();
  }

  function submit(url, options, force) {
    hideErr();
    var go = $("go");
    go.disabled = true;
    api("/api/jobs", "POST", { url: url, options: options, force: !!force }).then(function (res) {
      go.disabled = false;
      if (!res.ok) { showErr(res.j.error || "Something went wrong."); return; }
      if (res.j.ownerToken) saveOwner(res.j.id, res.j.ownerToken);
      state.cachedNotice = !!res.j.cached;
      history.pushState({}, "", "/v/" + res.j.id);
      watch(res.j.id);
    }).catch(function () { go.disabled = false; showErr("Network error. Try again."); });
  }

  $("f").addEventListener("submit", function (e) {
    e.preventDefault();
    submit($("url").value, opts, false);
  });

  function loadExamples() {
    api("/api/examples").then(function (res) {
      var list = res.j;
      if (!res.ok || !list.length) return;
      var grid = $("grid");
      list.forEach(function (x) {
        var a = document.createElement("a");
        a.className = "card fmt-" + (x.format || "landscape");
        a.href = "/v/" + x.id;
        var thumb = x.poster
          ? '<img class="thumb" loading="lazy" alt="" src="/posters/' + x.id + '.jpg" />'
          : '<video class="thumb" muted preload="metadata" src="/videos/' + x.id + '.mp4#t=1.2"></video>';
        a.innerHTML = thumb + '<div class="meta"><div class="t"></div><div class="c"><span class="cc"></span><span class="cv"></span></div></div>';
        a.querySelector(".t").textContent = x.title || x.canonical;
        a.querySelector(".cc").textContent = x.canonical;
        a.querySelector(".cv").textContent = (x.format && x.format !== "landscape" ? FORMAT_LABEL[x.format].split(" ")[0] + " · " : "") + (x.views === 1 ? "1 view" : (x.views || 0) + " views");
        grid.appendChild(a);
      });
      $("examples").style.display = "block";
    }).catch(function () {});
  }

  if (JOB) { watch(JOB); } else { loadExamples(); }
})();
</script>
</body>
</html>
`;
}
