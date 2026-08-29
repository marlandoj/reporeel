export function pageHtml(jobId: string | null): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>RepoReel — paste a repo, get a movie</title>
<meta name="description" content="Turn any public GitHub repo into a narrated explainer video. No accounts, no sign-up, no email. Paste a link, get a movie." />
<meta property="og:title" content="RepoReel — paste a repo, get a movie" />
<meta property="og:description" content="Turn any public GitHub repo into a narrated explainer video. No accounts required." />
<meta property="og:image" content="/og.png" />
<meta name="twitter:card" content="summary_large_image" />
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
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 72px; }
  .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; }
  .logo b { color: #22d3ee; }
  .gh-link { color: #9aa7b8; text-decoration: none; font-size: 15px; border: 1px solid rgba(231,237,245,.12); padding: 8px 16px; border-radius: 999px; transition: all .2s; }
  .gh-link:hover { color: #e7edf5; border-color: rgba(231,237,245,.3); }
  .hero { text-align: center; margin-bottom: 48px; }
  .hero h1 { font-size: clamp(38px, 6vw, 64px); font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; margin: 0 0 18px; }
  .hero h1 .accent { color: #22d3ee; }
  .hero p { font-size: 19px; color: #9aa7b8; margin: 0 auto; max-width: 560px; line-height: 1.55; }
  .noacct { display: inline-flex; align-items: center; gap: 8px; margin-top: 20px; font-size: 14px; color: #22d3ee; background: rgba(34,211,238,.08); border: 1px solid rgba(34,211,238,.2); padding: 7px 16px; border-radius: 999px; font-weight: 600; letter-spacing: .04em; }
  form { display: flex; gap: 12px; max-width: 640px; margin: 40px auto 0; }
  input[type=url], input[type=text] { flex: 1; background: rgba(231,237,245,.05); border: 1px solid rgba(231,237,245,.14); color: #e7edf5; border-radius: 14px; padding: 16px 20px; font-size: 16px; outline: none; transition: border-color .2s; }
  input:focus { border-color: rgba(34,211,238,.5); }
  input::placeholder { color: #5b6878; }
  button.cta { background: linear-gradient(90deg, #22d3ee, #67e8f9); color: #06222a; border: none; border-radius: 14px; padding: 16px 28px; font-size: 16px; font-weight: 700; cursor: pointer; transition: transform .15s, box-shadow .2s; white-space: nowrap; }
  button.cta:hover { transform: translateY(-1px); box-shadow: 0 8px 30px rgba(34,211,238,.25); }
  button.cta:disabled { opacity: .5; cursor: default; transform: none; box-shadow: none; }
  .err { max-width: 640px; margin: 18px auto 0; color: #fca5a5; background: rgba(248,113,113,.08); border: 1px solid rgba(248,113,113,.25); border-radius: 12px; padding: 12px 18px; font-size: 15px; display: none; }
  .panel { max-width: 640px; margin: 48px auto 0; background: rgba(231,237,245,.04); border: 1px solid rgba(231,237,245,.1); border-radius: 20px; padding: 32px; display: none; }
  .panel h2 { margin: 0 0 6px; font-size: 22px; font-weight: 700; }
  .panel .sub { color: #9aa7b8; font-size: 15px; margin-bottom: 24px; word-break: break-all; }
  .steps { display: flex; flex-direction: column; gap: 14px; }
  .step { display: flex; align-items: center; gap: 14px; color: #5b6878; font-size: 16px; transition: color .3s; }
  .step .ico { width: 26px; height: 26px; border-radius: 50%; border: 2px solid rgba(231,237,245,.15); display: grid; place-items: center; font-size: 13px; flex-shrink: 0; transition: all .3s; }
  .step.active { color: #e7edf5; }
  .step.active .ico { border-color: #22d3ee; color: #22d3ee; animation: pulse 1.4s ease-in-out infinite; }
  .step.done { color: #9aa7b8; }
  .step.done .ico { border-color: #34d399; color: #34d399; }
  @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,211,238,.3); } 50% { box-shadow: 0 0 0 7px rgba(34,211,238,0); } }
  .queue-note { margin-top: 18px; font-size: 14px; color: #5b6878; }
  .player { max-width: 860px; margin: 48px auto 0; display: none; }
  .player video { width: 100%; border-radius: 20px; border: 1px solid rgba(231,237,245,.12); box-shadow: 0 24px 80px rgba(0,0,0,.5); background: #000; }
  .player .actions { display: flex; gap: 12px; justify-content: center; margin-top: 22px; flex-wrap: wrap; }
  .btn2 { background: rgba(231,237,245,.06); border: 1px solid rgba(231,237,245,.14); color: #e7edf5; border-radius: 12px; padding: 12px 22px; font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none; transition: all .2s; }
  .btn2:hover { border-color: rgba(34,211,238,.4); color: #22d3ee; }
  .examples { margin-top: 88px; }
  .examples h3 { font-size: 15px; letter-spacing: .18em; text-transform: uppercase; color: #5b6878; text-align: center; margin-bottom: 28px; font-weight: 700; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
  .card { display: block; background: rgba(231,237,245,.04); border: 1px solid rgba(231,237,245,.1); border-radius: 16px; overflow: hidden; text-decoration: none; color: #e7edf5; transition: transform .18s, border-color .2s; }
  .card:hover { transform: translateY(-3px); border-color: rgba(34,211,238,.35); }
  .card video { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; background: #0b0f16; }
  .card .meta { padding: 14px 16px; }
  .card .t { font-weight: 700; font-size: 16px; }
  .card .c { color: #5b6878; font-size: 13px; margin-top: 4px; }
  footer { position: relative; z-index: 1; text-align: center; padding: 40px 24px 56px; color: #5b6878; font-size: 14px; line-height: 1.8; }
  footer a { color: #9aa7b8; }
  @media (max-width: 560px) { form { flex-direction: column; } header { margin-bottom: 48px; } }
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
  <section class="hero">
    <h1>Paste a repo.<br /><span class="accent">Get a movie.</span></h1>
    <p>RepoReel turns any public GitHub repository or pull request into a short narrated explainer video. Rendered on the spot, shareable by link.</p>
    <div class="noacct">NO ACCOUNTS · NO SIGN-UP · NO EMAIL</div>
    <form id="f">
      <input id="url" type="text" placeholder="https://github.com/owner/repo" autocomplete="off" spellcheck="false" required />
      <button class="cta" id="go" type="submit">Make the reel</button>
    </form>
    <div class="err" id="err"></div>
  </section>
  <section class="panel" id="panel">
    <h2 id="p-title">Building your reel</h2>
    <div class="sub" id="p-sub"></div>
    <div class="steps" id="steps">
      <div class="step" data-s="queued"><span class="ico">1</span> Queued</div>
      <div class="step" data-s="ingesting"><span class="ico">2</span> Reading the repository</div>
      <div class="step" data-s="scripting"><span class="ico">3</span> Writing the script</div>
      <div class="step" data-s="voicing"><span class="ico">4</span> Recording narration</div>
      <div class="step" data-s="rendering"><span class="ico">5</span> Rendering the video</div>
    </div>
    <div class="queue-note" id="q-note"></div>
  </section>
  <section class="player" id="player">
    <video id="vid" controls playsinline></video>
    <div class="actions">
      <button class="btn2" id="copy">Copy link</button>
      <a class="btn2" id="dl" download>Download MP4</a>
      <a class="btn2" href="/">Make another</a>
    </div>
  </section>
  <section class="examples" id="examples" style="display:none">
    <h3>Fresh from the reel</h3>
    <div class="grid" id="grid"></div>
  </section>
</main>
<footer>
  Built solo in 48 hours for <a href="https://hackyard.tech" target="_blank" rel="noopener">Hackyard Yard #1</a> — theme: no accounts.<br />
  Open source at <a href="https://github.com/marlandoj/reporeel" target="_blank" rel="noopener">github.com/marlandoj/reporeel</a>. Videos are AI-generated from public repo data.
</footer>
<script>
(function () {
  var JOB = ${jobId ? JSON.stringify(jobId) : "null"};
  var ORDER = ["queued", "ingesting", "scripting", "voicing", "rendering"];
  var f = document.getElementById("f");
  var err = document.getElementById("err");
  var panel = document.getElementById("panel");
  var player = document.getElementById("player");
  var pollTimer = null;

  function showErr(m) { err.textContent = m; err.style.display = "block"; }
  function hideErr() { err.style.display = "none"; }

  function setStage(status) {
    var idx = ORDER.indexOf(status);
    document.querySelectorAll(".step").forEach(function (el, i) {
      el.classList.remove("active", "done");
      if (i < idx) el.classList.add("done");
      if (i === idx) el.classList.add("active");
      if (status === "done") el.classList.add("done");
    });
  }

  function showVideo(id, title) {
    panel.style.display = "none";
    player.style.display = "block";
    var v = document.getElementById("vid");
    v.src = "/videos/" + id + ".mp4";
    document.getElementById("dl").href = "/videos/" + id + ".mp4";
    document.title = (title || "Your reel") + " — RepoReel";
    document.getElementById("copy").onclick = function () {
      navigator.clipboard.writeText(location.origin + "/v/" + id);
      this.textContent = "Copied";
      var b = this; setTimeout(function () { b.textContent = "Copy link"; }, 1600);
    };
  }

  function poll(id) {
    fetch("/api/jobs/" + id, { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.error && j.status === "error") {
          panel.style.display = "none";
          var hero = document.querySelector(".hero");
          hero.querySelector("form").style.display = "";
          hero.querySelector("h1").style.fontSize = "";
          hero.querySelector("p").style.display = "";
          showErr(j.error);
          clearInterval(pollTimer);
          return;
        }
        document.getElementById("p-sub").textContent = j.url || "";
        setStage(j.status);
        var note = document.getElementById("q-note");
        if (j.status === "queued" && j.position > 0) {
          note.textContent = j.position + " ahead of you in the queue.";
        } else if (j.status === "rendering") {
          note.textContent = "Rendering takes a couple of minutes. This page updates itself.";
        } else {
          note.textContent = "";
        }
        if (j.status === "done") {
          clearInterval(pollTimer);
          showVideo(id, j.title);
        }
      })
      .catch(function () {});
  }

  function watch(id) {
    hideErr();
    var hero = document.querySelector(".hero");
    hero.querySelector("form").style.display = "none";
    hero.querySelector("h1").style.fontSize = "34px";
    hero.querySelector("p").style.display = "none";
    panel.style.display = "block";
    document.getElementById("examples").style.display = "none";
    setStage("queued");
    poll(id);
    pollTimer = setInterval(function () { poll(id); }, 2500);
  }

  f.addEventListener("submit", function (e) {
    e.preventDefault();
    hideErr();
    var go = document.getElementById("go");
    go.disabled = true;
    fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ url: document.getElementById("url").value }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        go.disabled = false;
        if (!res.ok) { showErr(res.j.error || "Something went wrong."); return; }
        history.pushState({}, "", "/v/" + res.j.id);
        watch(res.j.id);
      })
      .catch(function () { go.disabled = false; showErr("Network error. Try again."); });
  });

  function loadExamples() {
    fetch("/api/examples", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (list) {
        if (!list.length) return;
        var grid = document.getElementById("grid");
        list.forEach(function (x) {
          var a = document.createElement("a");
          a.className = "card";
          a.href = "/v/" + x.id;
          a.innerHTML =
            '<video muted preload="metadata" src="/videos/' + x.id + '.mp4#t=1.2"></video>' +
            '<div class="meta"><div class="t"></div><div class="c"></div></div>';
          a.querySelector(".t").textContent = x.title || x.canonical;
          a.querySelector(".c").textContent = x.canonical;
          grid.appendChild(a);
        });
        document.getElementById("examples").style.display = "block";
      })
      .catch(function () {});
  }

  if (JOB) { watch(JOB); } else { loadExamples(); }
})();
</script>
</body>
</html>
`;
}
