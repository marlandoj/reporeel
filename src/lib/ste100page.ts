import { STE_RULES, STE_SECTIONS } from "./steapi";

const RULE_TABLE_ROWS = STE_RULES.map(
  (r: { id: string; text: string; mechanical: boolean }) => `<tr><td class="rid">${r.id}</td><td>${r.text}</td><td class="mech">${r.mechanical ? "yes" : "no"}</td></tr>`
).join("\n");

export function stePageHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#0d0c0a" />
<meta name="color-scheme" content="dark" />
<title>Plain-language writer — ASD-STE100 — RepoReel</title>
<meta name="description" content="Rewrite technical text in ASD-STE100 Simplified Technical English, check it against the mechanical rules, and download the result." />
<meta name="robots" content="noindex" />
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
  }

  .nav { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 26px 0; flex-wrap: wrap; }
  .logo { display: inline-flex; align-items: center; gap: 11px; text-decoration: none; color: var(--ink); font-size: 21px; font-weight: 700; letter-spacing: -.01em; }
  .logo-mark { width: 30px; height: 30px; display: block; }
  .logo b { color: var(--acc); font-weight: 700; }
  .back { color: var(--muted); text-decoration: none; font-size: 14.5px; font-weight: 600; border: 1px solid var(--line-2); padding: 10px 18px; border-radius: 999px; transition: color .18s var(--ease), border-color .18s var(--ease), transform .18s var(--ease); touch-action: manipulation; user-select: none; -webkit-user-select: none; }
  @media (hover: hover) and (pointer: fine) {
    .back:hover { color: var(--ink); border-color: var(--acc-line); transform: translateY(-1px); }
  }
  .back:active { transform: scale(.97); }

  .page-head { padding: 30px 0 40px; max-width: 860px; }
  .kicker { display: inline-flex; align-items: center; gap: 9px; font-family: var(--font-m); font-size: 12px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: var(--acc); background: var(--acc-soft); border: 1px solid var(--acc-line); padding: 8px 16px; border-radius: 999px; }
  .kicker::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--acc); box-shadow: 0 0 10px var(--acc); }
  h1 { font-size: clamp(34px, 4.6vw, 54px); font-weight: 700; letter-spacing: -.035em; line-height: 1.04; margin: 24px 0 16px; }
  h1 .accent { color: var(--acc); }
  .lede { color: var(--muted); font-size: 17.5px; line-height: 1.6; margin: 0 0 16px; max-width: 62ch; }
  .facts { color: var(--dim); font-size: 14px; line-height: 1.7; margin: 0; max-width: 78ch; }
  .facts a { color: var(--muted); transition: color .18s var(--ease); }
  .facts a:hover { color: var(--acc); }

  .work { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; align-items: start; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 26px; }
  .card h2 { font-family: var(--font-m); font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--dim); margin: 0 0 18px; font-weight: 600; }

  textarea, select, input[type=text] { width: 100%; background: var(--surface-2); border: 1px solid var(--line-2); color: var(--ink); border-radius: var(--r-sm); padding: 13px 15px; font-size: 16px; outline: none; font-family: var(--font-d); transition: border-color .18s var(--ease), box-shadow .18s var(--ease); }
  textarea { resize: vertical; min-height: 280px; line-height: 1.55; font-size: 15.5px; }
  textarea:focus, select:focus, input[type=text]:focus { border-color: var(--acc-line); box-shadow: 0 0 0 4px rgba(240,168,50,.12); }
  select { appearance: none; -webkit-appearance: none; cursor: pointer; padding-right: 42px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23a79b84' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 16px center; background-size: 12px; }
  select option, select optgroup { background: #171410; color: var(--ink); }

  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 14px; }
  .row.sel { align-items: stretch; }
  .row.sel > div { flex: 1; min-width: 150px; }
  .opt-label { display: block; font-family: var(--font-m); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--dim); font-weight: 600; margin-bottom: 8px; }

  .btn { display: inline-flex; align-items: center; gap: 8px; background: transparent; border: 1px solid var(--line-2); color: var(--ink); border-radius: 999px; padding: 11px 20px; font-size: 14.5px; font-weight: 600; cursor: pointer; text-decoration: none; font-family: var(--font-d); transition: border-color .18s var(--ease), color .18s var(--ease), transform .16s var(--ease), background .18s var(--ease), box-shadow .2s var(--ease); touch-action: manipulation; user-select: none; -webkit-user-select: none; }
  @media (hover: hover) and (pointer: fine) { .btn:hover { border-color: var(--acc-line); color: var(--acc); } }
  .btn:active { transform: scale(.97); }
  .btn:disabled { opacity: .5; cursor: default; transform: none; }
  .btn.primary { background: var(--acc); color: var(--acc-ink); border: none; font-weight: 700; padding: 12px 24px; }
  @media (hover: hover) and (pointer: fine) { .btn.primary:hover { background: var(--acc-hi); color: var(--acc-ink); box-shadow: 0 10px 30px rgba(240,168,50,.28); } }
  .btn.sm { padding: 8px 15px; font-size: 13px; }

  .err { margin-top: 14px; color: var(--bad); background: rgba(240,154,141,.08); border: 1px solid rgba(240,154,141,.3); border-radius: var(--r-md); padding: 12px 16px; font-size: 14.5px; display: none; }

  .score { display: flex; align-items: baseline; gap: 12px; margin: 4px 0 16px; }
  .score .n { font-size: 46px; font-weight: 700; letter-spacing: -.03em; line-height: 1; font-variant-numeric: tabular-nums; }
  .score .of { color: var(--faint); font-size: 15px; }
  .bar { height: 8px; border-radius: 999px; background: rgba(239,232,217,.08); overflow: hidden; margin-bottom: 20px; }
  .bar i { display: block; height: 100%; background: var(--acc); border-radius: 999px; transition: width .5s var(--ease); }
  #summary { color: var(--muted); font-size: 15px; line-height: 1.6; }
  #summary table { margin-top: 14px; }
  .out { margin-top: 22px; }
  .out pre { background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 20px 22px; font-family: var(--font-m); font-size: 13.5px; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--ink); max-height: 460px; overflow: auto; margin: 0 0 14px; }

  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th { text-align: left; color: var(--faint); font-family: var(--font-m); font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; font-weight: 600; padding: 8px 10px 8px 0; border-bottom: 1px solid var(--line-2); }
  td { padding: 10px 10px 10px 0; border-bottom: 1px solid var(--line); vertical-align: top; color: var(--muted); line-height: 1.55; }
  tr.clickable { cursor: pointer; }
  @media (hover: hover) and (pointer: fine) { tr.clickable:hover td { background: rgba(240,168,50,.05); } }
  td.rid { font-family: var(--font-m); color: var(--acc); white-space: nowrap; font-weight: 600; }
  td.mech { color: var(--dim); white-space: nowrap; font-family: var(--font-m); font-size: 12px; }

  details { margin-top: 34px; }
  summary { cursor: pointer; color: var(--muted); font-size: 15.5px; font-weight: 600; transition: color .18s var(--ease); }
  summary:hover { color: var(--acc); }
  .sect { margin: 24px 0 6px; font-family: var(--font-m); font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--acc); font-weight: 600; }

  footer { position: relative; z-index: 1; border-top: 1px solid var(--line); margin-top: 88px; padding: 36px 24px 60px; text-align: center; color: var(--faint); font-size: 13px; line-height: 1.9; font-family: var(--font-m); }
  footer a { color: var(--muted); transition: color .18s var(--ease); }
  footer a:hover { color: var(--acc); }
  footer p { margin: 0 0 8px; }

  @media (max-width: 900px) { .work { grid-template-columns: 1fr; } }
  @media (max-width: 640px) {
    .card { padding: 20px; }
    .page-head { padding-top: 16px; }
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
    <a class="back" href="/">Back to the reel maker</a>
  </header>

  <div class="page-head">
    <span class="kicker rise" style="--i:1">ASD-STE100 &middot; mechanical check</span>
    <h1 class="rise" style="--i:2">Plain-language writer.<br /><span class="accent">STE100, applied.</span></h1>
    <p class="lede rise" style="--i:3">The controlled language aerospace maintenance manuals are written in. Paste text, a README, an incident note, or a generated RepoReel script, and get it back rewritten in Simplified Technical English with a rule-by-rule report you can hand to a reviewer.</p>
    <p class="facts rise" style="--i:4">
    This is a practical subset of the 53 writing rules in ASD-STE100 Issue 9, paraphrased and implemented for software documentation. The check is mechanical: it finds what a program can prove, not what a judge would decide. Full compliance needs the official dictionary, which is a free download at <a href="https://asd-ste100.org" target="_blank" rel="noopener">asd-ste100.org</a>. ASD-STE100 is a registered trademark of ASD; RepoReel is an unofficial aid and is not affiliated with or endorsed by ASD.
  </p>
  </div>

  <div class="work rise" style="--i:5">
    <section class="card">
      <h2>Source text</h2>
      <textarea id="in" placeholder="Paste any technical text here. Markdown, plain text, or a README."></textarea>
      <div class="row">
        <button class="btn sm" id="upload" type="button">Load a file</button>
        <input type="file" id="file" accept=".md,.txt,.text,.srt,text/*" style="display:none" />
        <button class="btn sm" id="pull" type="button">Load a RepoReel script</button>
        <button class="btn sm" id="sample" type="button">Example</button>
        <button class="btn sm" id="clear" type="button">Clear</button>
      </div>
      <div class="row sel">
        <div>
          <span class="opt-label">Strength</span>
          <select id="strength">
            <option value="strict">Strict (full rules)</option>
            <option value="soft" selected>80% of the way (recommended)</option>
            <option value="light">Light pass (structure only)</option>
          </select>
        </div>
        <div>
          <span class="opt-label">Tone</span>
          <select id="tone">
            <option value="keep">Keep my tone</option>
            <option value="formal">Formal report</option>
            <option value="friendly">Friendly docs</option>
          </select>
        </div>
      </div>
      <div class="row">
        <button class="btn primary" id="go">Rewrite in STE100</button>
        <button class="btn" id="lint">Check only (no AI)</button>
      </div>
      <div class="err" id="err"></div>
    </section>

    <section class="card">
      <h2>Report</h2>
      <div class="score"><span class="n" id="score-n">0</span><span class="of">of <span id="score-t">0</span> sentences need a change</span></div>
      <div class="bar"><i id="score-bar" style="width:0%"></i></div>
      <div id="summary" style="color:#9aa7b8;font-size:15px">Paste text and press Check to see the findings. The rewrite runs the same rules and then tries to fix each one.</div>
      <div class="out" id="out" style="display:none">
        <pre id="out-text"></pre>
        <div class="row">
          <button class="btn sm" id="d-md" type="button">Download .md</button>
          <button class="btn sm" id="d-txt" type="button">Download .txt</button>
          <button class="btn sm" id="d-html" type="button">Download .html</button>
          <button class="btn sm" id="d-clip" type="button">Copy</button>
        </div>
      </div>
    </section>
  </div>

  <details ${""}>
    <summary>The ${STE_RULES.length} writing rules this tool knows, and which ones a program can prove</summary>
    ${STE_SECTIONS.map(
      (s: { id: string; title: string }) =>
        `<div class="sect">${s.title}</div><table><thead><tr><th style="width:64px">Rule</th><th>Instruction</th><th style="width:96px">Checked</th></tr></thead><tbody>${STE_RULES.filter(
          (r) => r.section === s.id
        )
          .map((r: { id: string; text: string; mechanical: boolean }) => `<tr class="clickable" data-rule="${r.id}"><td class="rid">${r.id}</td><td>${r.text}</td><td class="mech">${r.mechanical ? "mechanical" : "judgement"}</td></tr>`)
          .join("")}</tbody></table>`
    ).join("")}
    <div class="row"><button class="btn" id="d-ref">Download the quick reference (PDF)</button><button class="btn" id="d-refmd">Download the quick reference (Markdown)</button></div>
  </details>
</main>
<footer>
  <p>Rules paraphrased from ASD-STE100 Issue 9. Machine-assisted aid, not certification.</p>
  <p><a href="/">RepoReel</a>: turn any public repo into a narrated explainer video.</p>
</footer>
<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var inText = $("in"), out = $("out"), outText = $("out-text");
  var current = "";

  function showErr(m) { $("err").textContent = m; $("err").style.display = m ? "block" : "none"; }
  function clearErr() { $("err").style.display = "none"; }

  function renderReport(rep) {
    current = rep.output || "";
    var flagged = rep.flaggedSentences || 0;
    var total = rep.sentenceCount || 0;
    $("score-n").textContent = flagged;
    $("score-t").textContent = total;
    $("score-bar").style.width = total ? Math.round(((total - flagged) / total) * 100) + "%" : "0%";
    var sum = $("summary");
    sum.innerHTML = "";
    if (!total) { sum.textContent = "No sentences found. Paste some text."; return; }
    var p = document.createElement("div");
    p.textContent = flagged
      ? flagged + " of " + total + " sentences have a mechanical finding. The table below groups them by rule."
      : "No mechanical findings. " + total + " sentences checked.";
    sum.appendChild(p);
    if (!rep.byRule || !rep.byRule.length) return;
    var tbl = document.createElement("table");
    tbl.innerHTML = "<thead><tr><th style=\\"width:64px\\">Rule</th><th>Finding</th><th style=\\"width:64px\\">Count</th></tr></thead>";
    var tb = document.createElement("tbody");
    rep.byRule.forEach(function (g) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td class=\\"rid\\"></td><td></td><td class=\\"mech\\"></td>";
      tr.children[0].textContent = g.rule;
      tr.children[1].textContent = g.label;
      tr.children[2].textContent = g.count;
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    sum.appendChild(tbl);
    if (rep.output) {
      out.style.display = "block";
      outText.textContent = rep.output;
    } else {
      out.style.display = "none";
    }
  }

  function post(path, body) {
    return fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); });
  }

  $("go").onclick = function () {
    var b = this;
    var text = inText.value.trim();
    if (!text) { showErr("Paste some text first."); return; }
    clearErr();
    b.disabled = true; b.textContent = "Rewriting…";
    post("/api/ste100/rewrite", { text: text, strength: $("strength").value, tone: $("tone").value })
      .then(function (res) {
        b.disabled = false; b.textContent = "Rewrite in STE100";
        if (!res.ok) { showErr(res.j.error || "The rewrite failed."); return; }
        renderReport(res.j);
      })
      .catch(function () { b.disabled = false; b.textContent = "Rewrite in STE100"; showErr("Network error. Try again."); });
  };

  $("lint").onclick = function () {
    var text = inText.value.trim();
    if (!text) { showErr("Paste some text first."); return; }
    clearErr();
    $("lint").disabled = true;
    post("/api/ste100/lint", { text: text })
      .then(function (res) {
        $("lint").disabled = false;
        if (!res.ok) { showErr(res.j.error || "The check failed."); return; }
        renderReport(res.j);
      })
      .catch(function () { $("lint").disabled = false; showErr("Network error. Try again."); });
  };

  $("clear").onclick = function () { inText.value = ""; clearErr(); out.style.display = "none"; $("summary").textContent = "Paste text and press Check to see the findings."; };
  $("sample").onclick = function () {
    inText.value = "If the connection is slow, you\\'ll want to leverage the retry setting, which was added in order to make the client more robust, and it should be configured before the timeout. The retry mechanism is going to be enabled automatically once the build has completed successfully, so you don\\'t have to do anything else. This functionality is designed to ensure that etc. is handled properly in the event that the server does not respond in a timely manner; that is, when the network is under heavy load.";
  };
  $("upload").onclick = function () { $("file").click(); };
  $("file").onchange = function () {
    var f = this.files && this.files[0];
    if (!f) return;
    if (f.size > 200000) { showErr("That file is larger than 200 KB. Paste the part you need."); this.value = ""; return; }
    f.text().then(function (t) { inText.value = t; clearErr(); });
    this.value = "";
  };
  $("pull").onclick = function () {
    fetch("/api/ste100/scripts", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (list) {
        if (!list || !list.length) { showErr("No rendered scripts on this server yet. Make a reel first."); return; }
        var sel = window.prompt("Which script?\\n" + list.slice(0, 20).map(function (x, i) { return (i + 1) + ") " + x.title; }).join("\\n"), "1");
        var n = Number(sel);
        if (!n || n < 1 || n > list.length) return;
        return fetch("/api/ste100/scripts/" + encodeURIComponent(list[n - 1].id), { headers: { Accept: "application/json" } })
          .then(function (r) { return r.json(); })
          .then(function (j) { if (j.text) { inText.value = j.text; clearErr(); } else showErr(j.error || "Could not read that script."); });
      })
      .catch(function () { showErr("Network error. Try again."); });
  };

  function download(name, mime, text) {
    var blob = new Blob([text], { type: mime });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  $("d-md").onclick = function () { download("ste100-rewrite.md", "text/markdown", current); };
  $("d-txt").onclick = function () { download("ste100-rewrite.txt", "text/plain", current); };
  $("d-html").onclick = function () {
    var esc = current.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    download("ste100-rewrite.html", "text/html", "<!doctype html><meta charset=\\"utf-8\\"><title>STE100 rewrite</title><pre style=\\"font:14px/1.6 ui-monospace,Menlo,monospace;white-space:pre-wrap;max-width:70ch;margin:40px auto;padding:0 20px\\">" + esc + "</pre>");
  };
  $("d-clip").onclick = function () {
    var b = this;
    navigator.clipboard.writeText(current).then(function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1500); });
  };
  $("d-ref").onclick = function () { window.location.href = "/downloads/ste100-quick-reference.pdf"; };
  $("d-refmd").onclick = function () { window.location.href = "/downloads/ste100-quick-reference.md"; };
  document.querySelectorAll("tr.clickable").forEach(function (tr) {
    tr.onclick = function () {
      var re = new RegExp("(" + tr.getAttribute("data-rule").replace(/\\./g, "\\\\.") + "[^\\n]*)", "gi");
      outText.textContent = current.replace(re, function (m) { return "\\u001b[" + m + "\\u001b]"; });
      out.style.display = "block";
    };
  });
})();
</script>
</body>
</html>
`;
}
