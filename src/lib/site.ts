import { Hono } from "hono";
import { join } from "node:path";
import { pageHtml } from "./ui";

const root = join(import.meta.dir, "../..");
const assets: Record<string, [string, string]> = {
  "site.css": ["public/site/site.css", "text/css; charset=utf-8"],
  "studio.css": ["public/site/studio.css", "text/css; charset=utf-8"],
  "hermes-keynote.mp4": ["docs/examples/hermes-keynote.mp4", "video/mp4"],
  "hermes-keynote.jpg": ["docs/examples/hermes-keynote.jpg", "image/jpeg"],
  "hermes-keynote.vtt": [
    "public/site/hermes-keynote.vtt",
    "text/vtt; charset=utf-8",
  ],
};

/** Fixed, checked-in showcase assets only; never expose arbitrary repository files. */
export const site = new Hono();
site.get("/", (c) => c.html(homeHtml()));
site.get("/studio", (c) => c.html(pageHtml(null)));
site.get("/site/:asset", async (c) => {
  const asset = assets[c.req.param("asset")];
  if (!asset) return c.notFound();
  const file = Bun.file(join(root, asset[0]));
  if (!(await file.exists())) return c.notFound();
  const headers: Record<string, string> = {
    "Content-Type": asset[1],
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };
  if (asset[1] === "video/mp4") {
    headers["Accept-Ranges"] = "bytes";
    const range = c.req.header("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      const size = file.size;
      const start = match?.[1]
        ? Number(match[1])
        : Math.max(0, size - Number(match?.[2]));
      const end =
        match?.[1] && match[2]
          ? Math.min(Number(match[2]), size - 1)
          : size - 1;
      if (
        !match ||
        (!match[1] && !match[2]) ||
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= size
      ) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }
      return new Response(file.slice(start, end + 1), {
        status: 206,
        headers: {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }
  }
  return new Response(file, { headers });
});

const arrow = '<span aria-hidden="true">↗</span>';
export function homeHtml(): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>RepoReel — Your code has a story. Give it a screen.</title>
<meta name="description" content="Turn a public GitHub repository into a narrated movie. Review the script, choose your style, and share your work with RepoReel.">
<meta property="og:title" content="RepoReel — Your code has a story.">
<meta property="og:description" content="From GitHub repository to narrated movie. Made for the things you build.">
<meta property="og:type" content="website"><meta property="og:image" content="/og.png">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#f5f3ec">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='10' fill='%23ed4932'/%3E%3Cpath d='m16 11 14 9-14 9z' fill='%23fff'/%3E%3C/svg%3E">
<link rel="stylesheet" href="/site/site.css">
</head><body>
<a class="skip" href="#main">Skip to content</a>
<header class="nav wrap">
  <a class="brand" href="/" aria-label="RepoReel home"><span class="brand-icon" aria-hidden="true">▶</span> RepoReel<span class="brand-period">.</span></a>
  <nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#showcase">Showcase</a><a href="https://github.com/marlandoj/reporeel">GitHub ${arrow}</a></nav>
  <a class="button small" href="/studio">Open studio <span aria-hidden="true">→</span></a>
</header>
<main id="main">
<section class="hero wrap">
  <div class="hero-copy">
    <p class="eyebrow"><span class="signal" aria-hidden="true"></span> A SMALL STUDIO FOR BIG IDEAS</p>
    <h1>Your code<br>has a story.<br><span>Give it a screen.</span></h1>
    <p class="lead">You built something worth explaining. Turn your GitHub repo into a narrated movie people can watch, understand, and share.</p>
    <form action="/studio" method="get" class="repo-form">
      <label for="repo">Start with a public GitHub link</label>
      <div class="input-row"><span class="code-icon" aria-hidden="true">&lt;/&gt;</span><input id="repo" name="repo" type="url" placeholder="https://github.com/you/something-great" required maxlength="300" aria-describedby="repo-hint"><button class="button" type="submit">Make a reel <span aria-hidden="true">→</span></button></div>
    </form>
    <p class="micro" id="repo-hint">No account needed. Review your script before the cameras roll.</p>
    <a class="text-link" href="#showcase"><span class="play-small" aria-hidden="true">▶</span> See a real reel <span class="muted">/ 28 seconds</span></a>
  </div>
  <div class="hero-art" role="img" aria-label="A repository transforms into a film with a title, narrated scenes, and captions.">
    <div class="art-top"><span>REPO → REEL</span><span class="red-dot">● <span>READY WHEN YOU ARE</span></span></div>
    <div class="source-card"><span class="source-symbol">⌘</span><div><b>your-next-big-idea</b><span>README.md &nbsp; / &nbsp; source code</span></div><span class="source-check">✓</span></div>
    <div class="connector"><span>↓</span><span>LET’S TELL YOUR STORY</span></div>
    <div class="film-frame">
      <div class="frame-top"><span>01 / THE BIG PICTURE</span><span>16:9</span></div>
      <div class="orb orb-one"></div><div class="orb orb-two"></div><div class="orbit"></div>
      <div class="frame-title">Built with purpose.<br><em>Made to be seen.</em></div>
      <div class="frame-bottom"><span class="wave">▂ ▆ ▃ █ ▅ ▂ ▇ ▄ ▂ ▆ ▃ ▅ ▂</span><span>NARRATION ON</span></div>
    </div>
    <div class="timeline"><span class="time-label">00:00</span><span class="timeline-cell red"></span><span class="timeline-cell"></span><span class="timeline-cell"></span><span class="timeline-cell"></span><span class="time-label">THE END</span></div>
    <div class="art-bottom"><span>YOUR REPOSITORY. IN MOTION.</span><span>MP4 ↗</span></div>
    <span class="art-sticker">Less scrolling.<br><b>More storytelling.</b></span>
  </div>
</section>
<div class="ticker"><div class="wrap"><span>FROM THE THINGS YOU BUILD</span><span>Repositories</span><i>✳</i><span>Pull requests</span><i>✳</i><span>Releases</span><i>✳</i><span>Changelogs</span></div></div>
<section class="section wrap" id="how-it-works">
  <div class="section-heading"><div><p class="eyebrow">THE DIRECTOR’S CUT? YOURS.</p><h2>From source to screen.<br>With you in control.</h2></div><p>A simple workflow that keeps the story grounded in what you actually built.</p></div>
  <div class="steps-grid">
    <article><span class="step-num">01 / SOURCE</span><div class="step-visual source-visual" aria-hidden="true"><span>github.com/you/your-repo</span><b>↗</b></div><h3>Bring your repository.</h3><p>Paste a public repo, PR, release, or compare link. RepoReel reads the README, metadata, and source you choose.</p></article>
    <article><span class="step-num">02 / STORY</span><div class="step-visual story-visual" aria-hidden="true"><span>Scene 01 &nbsp; <i>Opening</i><br><b>Here’s what makes it different.</b></span><em>✓ Reviewed by you</em></div><h3>Make the story yours.</h3><p>Edit the script scene by scene. Choose the look, format, and captions, then approve the story before rendering.</p></article>
    <article><span class="step-num">03 / SCREEN</span><div class="step-visual screen-visual" aria-hidden="true"><b>▶</b><span>your-repo.mp4 <i>↓</i></span></div><h3>Roll it out.</h3><p>Get a narrated MP4, a shareable watch page, and optional subtitles. Take your story to your README or your next launch.</p></article>
  </div>
</section>
<section class="showcase" id="showcase"><div class="wrap showcase-grid">
  <div><p class="eyebrow">ACTUAL OUTPUT. PRESS PLAY.</p><h2>A little less<br>“read the docs.”<br><em>A little more show.</em></h2><p>Meet Hermes × Zouroboros in a short, narrated introduction rendered with Huashu Keynote.</p><div class="tags"><span>Keynote</span><span>16:9</span><span>28 seconds</span></div><a class="text-link" href="/studio?renderer=huashu-keynote">Try this animation style <span aria-hidden="true">↗</span></a></div>
  <div class="demo"><video controls playsinline preload="none" poster="/site/hermes-keynote.jpg" aria-label="Hermes and Zouroboros narrated demo"><source src="/site/hermes-keynote.mp4" type="video/mp4"><track kind="captions" src="/site/hermes-keynote.vtt" srclang="en" label="English" default>Your browser does not support video. <a href="/site/hermes-keynote.mp4">Download the demo</a>.</video><div class="demo-caption"><span>HERMES × ZOUROBOROS</span><a href="/site/hermes-keynote.mp4" download>Download MP4 ↓</a></div><details><summary>Read the transcript</summary><p>Meet Hermes and Zouroboros, a persistent workshop for your Linux VPS. Store decisions in shared memory. Retrieve the context when you return to your work. Connect Hermes through local MCP and inspect ready factory work without reserving or dispatching tickets. Prepare a campaign, review the plan, then explicitly start workers with your configured model provider.</p></details></div>
</div></section>
<section class="section wrap formats" id="formats"><div class="section-heading"><div><p class="eyebrow">ONE REPO. MANY SCREENS.</p><h2>Made for wherever<br>your work goes.</h2></div><p>A README introduction. A release announcement. A quick scroll-stopper. Pick a frame that fits.</p></div>
<div class="format-grid">
<a class="format-card" href="/studio?format=landscape"><div class="format-drawing"><div class="screen landscape"><span>BIG IDEAS.<br><em>Wide open.</em></span><b>▶</b></div></div><div><h3>Landscape <span>16:9 ↗</span></h3><p>READMEs, demos, and presentations</p></div></a>
<a class="format-card" href="/studio?format=vertical"><div class="format-drawing"><div class="screen vertical"><span>Small<br>screen.<br><em>Big story.</em></span><b>▶</b></div></div><div><h3>Vertical <span>9:16 ↗</span></h3><p>Shorts, Reels, and mobile feeds</p></div></a>
<a class="format-card" href="/studio?format=square"><div class="format-drawing"><div class="screen square"><span>A fresh<br><em>perspective.</em></span><b>▶</b></div></div><div><h3>Square <span>1:1 ↗</span></h3><p>Social posts and release updates</p></div></a>
</div></section>
<section class="readme-section wrap"><div class="readme-mock" aria-label="Illustration of a README video section"><div>README.md <span>Preview</span></div><h3>Your next great project</h3><p>A quick introduction to what you built.</p><div class="readme-player"><span>▶</span><b>Watch the overview</b></div><span class="readme-line"></span><span class="readme-line short"></span></div><div><p class="eyebrow">GIVE YOUR README A PLAY BUTTON</p><h2>A first impression<br>worth watching.</h2><p>Download your movie and add it to the place developers already visit. A short introduction gives people a reason to keep reading.</p><p class="readme-note">For inline playback on GitHub, upload the video as a GitHub attachment and add the attachment URL to your README. A repository MP4 link alone does not create an inline player.</p><a class="text-link" href="https://github.com/marlandoj/reporeel#running-it-yourself">Explore the project ${arrow}</a></div></section>
<section class="section wrap faq"><div><p class="eyebrow">BEFORE YOU HIT RECORD</p><h2>A few good questions.</h2></div><div>
<details><summary>Do I need an account?</summary><p>No. The studio does not require a login. The browser that creates a reel holds its editing token, so keep that browser’s local storage to return to script review.</p></details>
<details><summary>Can I review the movie before it renders?</summary><p>Script review is on by default. You can edit scene text and narration, request rewrites, then approve the script. The studio also offers several visual styles and the optional Huashu Keynote renderer.</p></details>
<details><summary>Does it work with private repositories?</summary><p>This site is designed for public GitHub sources. Do not submit private or confidential repositories to a public instance.</p></details>
<details><summary>What can I download?</summary><p>The finished MP4 and, when captions are enabled, an SRT subtitle file. You also get a watch page you can share. Save your downloads for long-term use: hosted reels can expire under the server’s retention policy.</p></details>
<details><summary>Can I run it on my own server?</summary><p>Yes. RepoReel is open source. The repository documents Bun, rendering dependencies, and model-provider setup. Generation uses the server’s configured model provider and compute resources. <a href="https://github.com/marlandoj/reporeel#running-it-yourself">Read the setup guide.</a></p></details>
</div></section>
<section class="closing wrap"><p class="eyebrow">YOU’VE ALREADY DONE THE HARD PART.</p><h2>Now give it<br>a great opening scene.</h2><a href="/studio" class="button">Make your first reel <span aria-hidden="true">→</span></a><p>No account. Your story. Action.</p></section>
</main><footer class="wrap"><a class="brand" href="/"><span class="brand-icon" aria-hidden="true">▶</span> RepoReel.</a><p>Made for the things you build.</p><nav aria-label="Footer"><a href="/studio">Studio</a><a href="/ste100">Plain-language writer</a><a href="https://github.com/marlandoj/reporeel">Source ${arrow}</a></nav><small>Videos are AI-generated from public repository data. Review for accuracy.</small></footer>
</body></html>`;
}
