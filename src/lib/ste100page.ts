import { STE_RULES, STE_SECTIONS } from "./steapi";

const RULE_TABLE_ROWS = STE_RULES.map(
  (r: { id: string; text: string; mechanical: boolean }) => `<tr><td class="rid">${r.id}</td><td>${r.text}</td><td class="mech">${r.mechanical ? "yes" : "no"}</td></tr>`
).join("\n");

export function stePageHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Plain-language writer — ASD-STE100 — RepoReel</title>
<meta name="description" content="Rewrite technical text in ASD-STE100 Simplified Technical English, check it against the mechanical rules, and download the result." />
<meta name="robots" content="noindex" />
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2307090d'/%3E%3Cpath d='M10 24V8h7.5a5 5 0 0 1 1.8 9.7L24 24h-4.4l-4-5.6H14V24z' fill='%2322d3ee'/%3E%3C/svg%3E" />
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #07090d; color: #e7edf5; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; min-height: 100vh; }
  .bg { position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background: radial-gradient(900px 540px at 15% 6%, rgba(34,211,238,.11), transparent 60%),
                radial-gradient(800px 560px at 88% 94%, rgba(167,139,250,.10), transparent 60%); }
  main { position: relative; z-index: 1; max-width: 1180px; margin: 0 auto; padding: 40px 24px 80px; }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 44px; gap: 16px; flex-wrap: wrap; }
  .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; text-decoration: none; color: inherit; }
  .logo b { color: #22d3ee; }
  .back { color: #9aa7b8; text-decoration: none; font-size: 15px; border: 1px solid rgba(231,237,245,.12); padding: 8px 16px; border-radius: 999px; }
  .back:hover { color: #e7edf5; border-color: rgba(231,237,245,.3); }
  h1 { font-size: clamp(30px, 5vw, 48px); font-weight: 800; letter-spacing: -0.03em; line-height: 1.08; margin: 0 0 14px; }
  h1 .accent { color: #22d3ee; }
  .lede { color: #9aa7b8; font-size: 18px; max-width: 760px; line-height: 1.55; margin: 0 0 18px; }
  .facts { color: #5b6878; font-size: 14px; line-height: 1.7; margin: 0 0 30px; max-width: 820px; }
  .facts a { color: #9aa7b8; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; align-items: start; }
  .card { background: rgba(231,237,245,.035); border: 1px solid rgba(231,237,245,.1); border-radius: 18px; padding: 22px 24px; }
  .card h2 { font-size: 15px; letter-spacing: .14em; text-transform: uppercase; color: #5b6878; margin: 0 0 14px; font-weight: 700; }
  textarea, select, input[type=text] { width: 100%; background: rgba(231,237,245,.05); border: 1px solid rgba(231,237,245,.14); color: #e7edf5; border-radius: 12px; padding: 12px 14px; font-size: 15px; outline: none; font-family: inherit; }
  textarea { resize: vertical; min-height: 280px; line-height: 1.55; font-size: 15px; }
  select option, select optgroup { background: #0b0f16; color: #e7edf5; }
  select option:hover, select option:focus, select option:checked { background: #17222f; color: #ffffff; }
  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
  .row.sel { align-items: stretch; }
  .row.sel > div { flex: 1; min-width: 140px; }
  .opt-label { display: block; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #5b6878; font-weight: 700; margin-bottom: 6px; }
  .btn { background: rgba(231,237,245,.06); border: 1px solid rgba(231,237,245,.14); color: #e7edf5; border-radius: 12px; padding: 11px 18px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; transition: all .2s; font-family: inherit; display: inline-block; }
  .btn:hover { border-color: rgba(34,211,238,.4); color: #22d3ee; }
  .btn:disabled { opacity: .5; cursor: default; }
  .btn.primary { background: linear-gradient(90deg, #22d3ee, #67e8f9); color: #06222a; border: none; }
  .btn.primary:hover { transform: translateY(-1px); box-shadow: 0 8px 26px rgba(34,211,238,.25); color: #06222a; }
  .btn.sm { padding: 8px 13px; font-size: 13px; border-radius: 9px; }
  .err { margin-top: 14px; color: #fca5a5; background: rgba(248,113,113,.08); border: 1px solid rgba(248,113,113,.25); border-radius: 12px; padding: 12px 16px; font-size: 14px; display: none; }
  .score { display: flex; align-items: baseline; gap: 12px; margin: 4px 0 16px; }
  .score .n { font-size: 42px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
  .score .of { color: #5b6878; font-size: 15px; }
  .bar { height: 8px; border-radius: 999px; background: rgba(231,237,245,.08); overflow: hidden; margin-bottom: 20px; }
  .bar i { display: block; height: 100%; background: linear-gradient(90deg, #22d3ee, #34d399); }
  .mark { border-radius: 4px; padding: 1px 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th { text-align: left; color: #5b6878; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; font-weight: 700; padding: 8px 10px 8px 0; border-bottom: 1px solid rgba(231,237,245,.1); }
  td { padding: 9px 10px 9px 0; border-bottom: 1px solid rgba(231,237,245,.06); vertical-align: top; }
  tr.clickable { cursor: pointer; }
  tr.clickable:hover td { background: rgba(34,211,238,.05); }
  td.rid { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: #a78bfa; white-space: nowrap; }
  td.mech { color: #5b6878; white-space: nowrap; }
  .out { margin-top: 22px; }
  .out pre { background: rgba(231,237,245,.04); border: 1px solid rgba(231,237,245,.1); border-radius: 14px; padding: 20px 22px; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 13.5px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; color: #cdd7e3; max-height: 460px; overflow: auto; margin: 0; }
  details { margin-top: 30px; }
  summary { cursor: pointer; color: #9aa7b8; font-size: 15px; font-weight: 600; }
  summary:hover { color: #e7edf5; }
  .sect { margin: 22px 0 8px; font-size: 13px; letter-spacing: .12em; text-transform: uppercase; color: #22d3ee; font-weight: 700; }
  footer { position: relative; z-index: 1; text-align: center; padding: 40px 24px; color: #5b6878; font-size: 13px; line-height: 1.8; }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="bg"></div>
<main>
  <header>
    <a class="logo" href="/"><b>Repo</b>Reel</a>
    <a class="back" href="/">Back to the reel maker</a>
  </header>

  <h1>Plain-language writer.<br /><span class="accent">ASD-STE100.</span></h1>
  <p class="lede">The controlled language aerospace maintenance manuals are written in. Paste text, a README, an incident note, or a generated RepoReel script, and get it back rewritten in Simplified Technical English with a rule-by-rule report you can hand to a reviewer.</p>
  <p class="facts">
    This is a practical subset of the 53 writing rules in ASD-STE100 Issue 9, paraphrased and implemented for software documentation. The check is mechanical: it finds what a program can prove, not what a judge would decide. Full compliance needs the official dictionary, which is a free download at <a href="https://asd-ste100.org" target="_blank" rel="noopener">asd-ste100.org</a>. ASD-STE100 is a registered trademark of ASD; RepoReel is an unofficial aid and is not affiliated with or endorsed by ASD.
  </p>

  <div class="grid">
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
  Rules paraphrased from ASD-STE100 Issue 9. Machine-assisted aid, not certification.<br />
  <a href="/">RepoReel</a> — turn any public repo into a narrated explainer video.
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
