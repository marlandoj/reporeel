import type { Job } from "./db";
import { FORMATS, parseOptions } from "./options";

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
<meta name="viewport" content="width=device-width, initial-scale=1" />
${metaTags(ctx)}
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2307090d'/%3E%3Cpath d='M10 24V8h7.5a5 5 0 0 1 1.8 9.7L24 24h-4.4l-4-5.6H14V24z' fill='%2322d3ee'/%3E%3C/svg%3E" />
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #07090d; color: #e7edf5; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; min-height: 100vh; }
  .bg { position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background: radial-gradient(900px 540px at 15% 8%, rgba(34,211,238,.12), transparent 60%),
                radial-gradient(800px 560px at 88% 92%, rgba(167,139,250,.11), transparent 60%); }
  .bg-grid { position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image: linear-gradient(rgba(231,237,245,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(231,237,245,.03) 1px, transparent 1px);
    background-size: 64px 64px;
    mask-image: radial-gradient(ellipse at 50% 30%, black 30%, transparent 75%); }
  main { position: relative; z-index: 1; max-width: 980px; margin: 0 auto; padding: 48px 24px 80px; }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 64px; }
  .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; }
  .logo b { color: #22d3ee; }
  .gh-link { color: #9aa7b8; text-decoration: none; font-size: 15px; border: 1px solid rgba(231,237,245,.12); padding: 8px 16px; border-radius: 999px; transition: all .2s; }
  .gh-link:hover { color: #e7edf5; border-color: rgba(231,237,245,.3); }
  .hero { text-align: center; margin-bottom: 40px; }
  .hero h1 { font-size: clamp(38px, 6vw, 64px); font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; margin: 0 0 18px; }
  .hero h1 .accent { color: #22d3ee; }
  .hero p { font-size: 19px; color: #9aa7b8; margin: 0 auto; max-width: 600px; line-height: 1.55; }
  .noacct { display: inline-flex; align-items: center; gap: 8px; margin-top: 20px; font-size: 14px; color: #22d3ee; background: rgba(34,211,238,.08); border: 1px solid rgba(34,211,238,.2); padding: 7px 16px; border-radius: 999px; font-weight: 600; letter-spacing: .04em; }
  form { display: flex; gap: 12px; max-width: 680px; margin: 36px auto 0; }
  input[type=url], input[type=text], textarea { background: rgba(231,237,245,.05); border: 1px solid rgba(231,237,245,.14); color: #e7edf5; border-radius: 14px; padding: 14px 18px; font-size: 16px; outline: none; transition: border-color .2s; font-family: inherit; }
  form input[type=text] { flex: 1; padding: 16px 20px; }
  input:focus, textarea:focus { border-color: rgba(34,211,238,.5); }
  input::placeholder, textarea::placeholder { color: #5b6878; }
  .hint { color: #5b6878; font-size: 13px; margin-top: 10px; }
  button.cta { background: linear-gradient(90deg, #22d3ee, #67e8f9); color: #06222a; border: none; border-radius: 14px; padding: 16px 28px; font-size: 16px; font-weight: 700; cursor: pointer; transition: transform .15s, box-shadow .2s; white-space: nowrap; }
  button.cta:hover { transform: translateY(-1px); box-shadow: 0 8px 30px rgba(34,211,238,.25); }
  button.cta:disabled { opacity: .5; cursor: default; transform: none; box-shadow: none; }
  .opts { max-width: 680px; margin: 22px auto 0; display: grid; grid-template-columns: 1fr 1fr; gap: 14px 22px; text-align: left; background: rgba(231,237,245,.03); border: 1px solid rgba(231,237,245,.08); border-radius: 18px; padding: 18px 22px; }
  .opt-label { display: block; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #5b6878; font-weight: 700; margin-bottom: 8px; }
  .seg { display: inline-flex; background: rgba(231,237,245,.05); border: 1px solid rgba(231,237,245,.1); border-radius: 12px; padding: 3px; gap: 3px; flex-wrap: wrap; }
  .seg button { background: transparent; border: none; color: #9aa7b8; font-size: 14px; font-weight: 600; padding: 8px 13px; border-radius: 9px; cursor: pointer; transition: all .15s; font-family: inherit; }
  .seg button.on { background: rgba(34,211,238,.16); color: #22d3ee; }
  .seg button small { display: block; font-size: 11px; font-weight: 500; color: #5b6878; margin-top: 1px; }
  .seg button.on small { color: rgba(34,211,238,.7); }
  .chk { display: flex; align-items: center; gap: 10px; font-size: 15px; color: #cdd7e3; cursor: pointer; margin-top: 6px; }
  .chk input { width: 18px; height: 18px; accent-color: #22d3ee; }
  .chk small { color: #5b6878; font-size: 13px; }
  .err { max-width: 680px; margin: 18px auto 0; color: #fca5a5; background: rgba(248,113,113,.08); border: 1px solid rgba(248,113,113,.25); border-radius: 12px; padding: 12px 18px; font-size: 15px; display: none; }
  .panel { max-width: 680px; margin: 40px auto 0; background: rgba(231,237,245,.04); border: 1px solid rgba(231,237,245,.1); border-radius: 20px; padding: 32px; display: none; }
  .panel h2 { margin: 0 0 6px; font-size: 22px; font-weight: 700; }
  .panel .sub { color: #9aa7b8; font-size: 15px; margin-bottom: 24px; word-break: break-all; }
  .steps { display: flex; flex-direction: column; gap: 14px; }
  .step { display: flex; align-items: center; gap: 14px; color: #5b6878; font-size: 16px; transition: color .3s; }
  .step .ico { width: 26px; height: 26px; border-radius: 50%; border: 2px solid rgba(231,237,245,.15); display: grid; place-items: center; font-size: 13px; flex-shrink: 0; transition: all .3s; }
  .step.active { color: #e7edf5; }
  .step.active .ico { border-color: #22d3ee; color: #22d3ee; animation: pulse 1.4s ease-in-out infinite; }
  .step.done { color: #9aa7b8; }
  .step.done .ico { border-color: #34d399; color: #34d399; }
  .step.hidden { display: none; }
  @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,211,238,.3); } 50% { box-shadow: 0 0 0 7px rgba(34,211,238,0); } }
  .bar { height: 8px; border-radius: 999px; background: rgba(231,237,245,.08); margin-top: 22px; overflow: hidden; display: none; }
  .bar i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #22d3ee, #a78bfa); transition: width .6s ease; }
  .queue-note { margin-top: 16px; font-size: 14px; color: #5b6878; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .btn2 { background: rgba(231,237,245,.06); border: 1px solid rgba(231,237,245,.14); color: #e7edf5; border-radius: 12px; padding: 12px 22px; font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none; transition: all .2s; font-family: inherit; }
  .btn2:hover { border-color: rgba(34,211,238,.4); color: #22d3ee; }
  .btn2:disabled { opacity: .5; cursor: default; }
  .btn2.sm { padding: 7px 14px; font-size: 13px; border-radius: 9px; }
  .btn2.danger:hover { border-color: rgba(248,113,113,.5); color: #fca5a5; }
  .review { max-width: 860px; margin: 40px auto 0; display: none; }
  .review h2 { font-size: 26px; margin: 0 0 6px; letter-spacing: -0.01em; }
  .review .lead { color: #9aa7b8; font-size: 15px; margin: 0 0 22px; line-height: 1.5; }
  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
  .field label { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: #5b6878; font-weight: 700; }
  .field input, .field textarea { width: 100%; font-size: 15px; padding: 11px 14px; border-radius: 11px; }
  .field textarea { resize: vertical; min-height: 64px; line-height: 1.45; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .scene-card { background: rgba(231,237,245,.04); border: 1px solid rgba(231,237,245,.1); border-radius: 18px; padding: 22px 24px; margin-top: 16px; }
  .scene-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 12px; flex-wrap: wrap; }
  .scene-head .n { font-weight: 800; font-size: 17px; }
  .kind { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #a78bfa; background: rgba(167,139,250,.12); border: 1px solid rgba(167,139,250,.25); padding: 4px 10px; border-radius: 999px; font-weight: 700; margin-left: 10px; }
  .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .stat-pair { display: flex; gap: 8px; }
  .stat-pair input { flex: 1; min-width: 0; }
  .words { font-size: 12px; color: #5b6878; text-align: right; }
  .warn { color: #fbbf24; background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.25); border-radius: 10px; padding: 9px 14px; font-size: 13px; margin-top: 10px; line-height: 1.45; }
  .rewrite { display: flex; gap: 10px; margin-top: 12px; align-items: center; }
  .rewrite input { flex: 1; font-size: 14px; padding: 9px 13px; border-radius: 10px; }
  .review-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; flex-wrap: wrap; align-items: center; }
  .review-actions .spacer { flex: 1; color: #5b6878; font-size: 13px; }
  .player { max-width: 860px; margin: 40px auto 0; display: none; }
  .player video { display: block; margin: 0 auto; width: 100%; border-radius: 20px; border: 1px solid rgba(231,237,245,.12); box-shadow: 0 24px 80px rgba(0,0,0,.5); background: #000; }
  .player.fmt-vertical video { width: min(100%, 400px); }
  .player.fmt-square video { width: min(100%, 600px); }
  .player .meta { text-align: center; color: #5b6878; font-size: 14px; margin-top: 14px; }
  .player .meta b { color: #9aa7b8; font-weight: 600; }
  .player .actions { display: flex; gap: 12px; justify-content: center; margin-top: 18px; flex-wrap: wrap; }
  .banner { max-width: 860px; margin: 16px auto 0; background: rgba(34,211,238,.06); border: 1px solid rgba(34,211,238,.2); border-radius: 12px; padding: 12px 18px; font-size: 14px; color: #cdd7e3; display: none; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .msg { max-width: 680px; margin: 40px auto 0; text-align: center; display: none; }
  .msg h2 { font-size: 24px; margin: 0 0 8px; }
  .msg p { color: #9aa7b8; margin: 0 0 20px; }
  .examples { margin-top: 88px; }
  .examples h3 { font-size: 15px; letter-spacing: .18em; text-transform: uppercase; color: #5b6878; text-align: center; margin-bottom: 28px; font-weight: 700; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; align-items: start; }
  .card { display: block; background: rgba(231,237,245,.04); border: 1px solid rgba(231,237,245,.1); border-radius: 16px; overflow: hidden; text-decoration: none; color: #e7edf5; transition: transform .18s, border-color .2s; }
  .card:hover { transform: translateY(-3px); border-color: rgba(34,211,238,.35); }
  .card .thumb { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; background: #0b0f16; }
  .card.fmt-vertical .thumb { aspect-ratio: 9/16; max-height: 360px; }
  .card.fmt-square .thumb { aspect-ratio: 1/1; }
  .card .meta { padding: 14px 16px; }
  .card .t { font-weight: 700; font-size: 16px; }
  .card .c { color: #5b6878; font-size: 13px; margin-top: 4px; display: flex; justify-content: space-between; gap: 8px; }
  footer { position: relative; z-index: 1; text-align: center; padding: 40px 24px 56px; color: #5b6878; font-size: 14px; line-height: 1.8; }
  footer a { color: #9aa7b8; }
  @media (max-width: 640px) { form { flex-direction: column; } header { margin-bottom: 48px; } .opts { grid-template-columns: 1fr; } .row2 { grid-template-columns: 1fr; } .stats-grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="bg"></div>
<div class="bg-grid"></div>
<main>
  <header>
    <a class="logo" href="/" style="text-decoration:none;color:inherit"><b>Repo</b>Reel</a>
    <a class="gh-link" href="https://github.com/marlandoj/reporeel" target="_blank" rel="noopener">Source on GitHub</a>
  </header>
  <section class="hero" id="hero">
    <h1 id="h1">Paste a repo.<br /><span class="accent">Get a movie.</span></h1>
    <p id="lede">RepoReel turns any public GitHub repository, pull request, or release into a short narrated explainer video. Review the script, pick a format, get a shareable link.</p>
    <div class="noacct" id="noacct">NO ACCOUNTS · NO SIGN-UP · NO EMAIL</div>
    <form id="f">
      <input id="url" type="text" placeholder="https://github.com/owner/repo" autocomplete="off" spellcheck="false" required />
      <button class="cta" id="go" type="submit">Make the reel</button>
    </form>
    <div class="opts" id="opts">
      <div>
        <span class="opt-label">Ground the story in</span>
        <div class="seg" data-name="grounding">
          <button type="button" data-v="readme">README</button>
          <button type="button" data-v="code">Code</button>
          <button type="button" data-v="both" class="on">Both</button>
        </div>
      </div>
      <div>
        <span class="opt-label">Format</span>
        <div class="seg" data-name="format">
          <button type="button" data-v="landscape" class="on">16:9<small>YouTube, X, LinkedIn</small></button>
          <button type="button" data-v="vertical">9:16<small>Shorts, Reels, TikTok</small></button>
          <button type="button" data-v="square">1:1<small>Feeds</small></button>
        </div>
      </div>
      <label class="chk"><input type="checkbox" id="captions" /> Burned-in captions <small>+ SRT file</small></label>
      <label class="chk"><input type="checkbox" id="review" checked /> Review the script before rendering</label>
    </div>
    <div class="hint" id="hint">Works with repo, pull request, release, and compare URLs. Try <code>owner/repo@v1.2.0</code> for a changelog reel.</div>
    <div class="err" id="err"></div>
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
    <video id="vid" controls playsinline></video>
    <div class="meta" id="v-meta"></div>
    <div class="actions">
      <button class="btn2" id="copy">Copy link</button>
      <a class="btn2" id="dl" download>Download MP4</a>
      <a class="btn2" id="dl-srt" download style="display:none">Download SRT</a>
      <button class="btn2" id="refresh">Check for updates</button>
      <a class="btn2" href="/">Make another</a>
    </div>
    <div class="banner" id="banner"><span id="banner-text"></span><button class="btn2 sm" id="banner-btn"></button></div>
  </section>
  <section class="msg" id="msg">
    <h2 id="msg-h"></h2>
    <p id="msg-p"></p>
    <div class="actions" style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><button class="btn2" id="msg-btn" style="display:none"></button><a class="btn2" href="/">Make another</a></div>
  </section>
  <section class="examples" id="examples" style="display:none">
    <h3>Fresh from the reel</h3>
    <div class="grid" id="grid"></div>
  </section>
</main>
<footer>
  Built solo in 48 hours for <a href="https://hackyard.tech" target="_blank" rel="noopener">Hackyard Yard #1</a> (2nd place) — theme: no accounts.<br />
  Open source at <a href="https://github.com/marlandoj/reporeel" target="_blank" rel="noopener">github.com/marlandoj/reporeel</a>. Videos are AI-generated from public repo data.
</footer>
<script>
(function () {
  var JOB = ${jobId ? JSON.stringify(jobId) : "null"};
  var ORDER = ["queued", "ingesting", "scripting", "review", "voicing", "rendering"];
  var FORMAT_LABEL = { landscape: "16:9 landscape", vertical: "9:16 vertical", square: "1:1 square" };
  function $(id) { return document.getElementById(id); }
  var state = { id: null, job: null, script: null, pollTimer: null, editorOpen: false, cachedNotice: false, captionsTouched: false };
  var opts = { grounding: "both", format: "landscape", captions: false, review: true };

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
      w.textContent = rs.warnings.length + " grounding " + (rs.warnings.length === 1 ? "warning" : "warnings") + ": some on-screen numbers or code lines could not be matched to the repo data. They are flagged on the scene below. Edit them or rewrite the scene.";
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
