# RepoReel

**Paste a public GitHub repo URL. Get a narrated explainer video. No accounts.**

Live: **https://reporeel-marlandoj.zocomputer.io**

Built solo in 48 hours for [Hackyard Yard #1](https://hackyard.tech/yards/yard-1) — theme: **"No accounts."**

## What it does

Give RepoReel any public GitHub repository, pull request, release, or compare URL and it produces a ~60 second narrated explainer video, on the spot:

1. **Ingest** — pulls the repo's real metadata, README, languages, and commit history from the GitHub API. For PRs: the diff stats and changed files. For releases and compares: the tag, notes, and the commits and files changed since the previous tag.
2. **Script** — an LLM turns those facts into a 6-scene video script with on-screen copy and a continuous voiceover, grounded in the fetched data. Code scenes are checked verbatim against the fetched source; anything the model invented is flagged.
3. **Review** (optional, on by default) — the script is shown to the person who started the reel before any rendering happens. Edit any scene by hand, ask the model to rewrite one scene, then approve.
4. **Voice** — narration is synthesized locally with Kokoro-82M (no cloud TTS).
5. **Render** — the scenes are compiled into a [HyperFrames](https://github.com/heygen-com/hyperframes) HTML composition (GSAP timeline, per-scene audio) and rendered headlessly to MP4, with optional burned-in captions and an `.srt` sidecar.

The finished reel lives at a shareable `/v/:id` link (with its own poster and OG image) and can be downloaded as a plain MP4. Typical end-to-end time: about 90 seconds.

### Options

| Option | Values | Notes |
| --- | --- | --- |
| `grounding` | `readme` \| `code` \| `both` | what the script is allowed to draw from: README and metadata, the source tree + manifest + entry file, or both (default `both`) |
| `format` | `landscape` 16:9 1280x720 \| `vertical` 9:16 720x1280 \| `square` 1:1 1080x1080 | landscape suits YouTube, X, and LinkedIn; vertical suits Shorts, Reels, and TikTok; square suits feeds |
| `captions` | `true` \| `false` | burned-in captions plus an `.srt` sidecar (default on for vertical and square) |
| `review` | `true` \| `false` | pause after scripting for an editable review step (default `true`) |

### Supported URLs

| URL | Mode |
| --- | --- |
| `github.com/owner/repo` | repo explainer |
| `github.com/owner/repo/pull/123` | pull request walkthrough |
| `github.com/owner/repo/releases/tag/v1.2.3`, `owner/repo@v1.2.3` | release / changelog reel for that tag |
| `github.com/owner/repo/releases/latest` | changelog reel for the newest release |
| `github.com/owner/repo/compare/v1.2...v1.3` | what changed between two refs |

### Keeping reels fresh

Every reel records the source's `pushed_at` (and release tag) at ingest time. `POST /api/jobs/:id/refresh` reports whether the source has moved since, and re-renders on request. Reels pinned to a specific tag or compare range are treated as immutable; `releases/latest` reels go stale only when a newer release appears.

## Theme fit: no accounts, honestly

- No sign-up, no login, no email — not for making videos, not for watching them, not for downloading them.
- No cookies, no tracking, no user identity of any kind. The server keeps a job queue and nothing about *you*.
- Abuse control without identity: per-IP rate limiting (3 new videos/hour), a bounded queue, and URL-plus-options caching so popular repos render once per format.
- The only per-person state is an owner token, handed back when a reel is started, that gates script editing and cancellation for that one reel. It is never stored server-side beyond the job row.

## Why this exists (a Hackyard story)

Every Yard submission is strongly encouraged to include a demo video. RepoReel makes explainer videos *for repos* — including the other 49 submissions in this Yard. Paste a competitor's repo, get their explainer. You're welcome.

## Running it yourself

Requirements: [Bun](https://bun.sh), ffmpeg, and Chrome/Chromium (HyperFrames downloads a headless build on first render).

```bash
bun install
OPENROUTER_API_KEY=your_key_here bun src/server.ts
```

Optional environment:

| Variable | Purpose | Default |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | LLM script generation (required) | — |
| `GITHUB_TOKEN` | higher GitHub API limits (falls back to `gh auth token`, then anonymous) | — |
| `PORT` | listen port | 3901 |
| `REPOREEL_RATE_LIMIT` | new videos per IP per hour | 3 |
| `REPOREEL_MAX_QUEUE` | max active jobs | 6 |
| `RENDER_DISABLED` | kill switch: reject new jobs | off |
| `REPOREEL_DATA_DIR` | where jobs, media, and the SQLite queue live | `./data` |
| `REPOREEL_RETENTION_DAYS` | delete finished reels older than this on the hourly sweep | 30 |

One-off CLI render, no server:

```bash
bun src/cli.ts https://github.com/owner/repo
bun src/cli.ts https://github.com/owner/repo/releases/latest --format vertical --grounding both --captions
```

## Architecture

```
Hono (Bun) server ── SQLite job queue ── serial worker
                                            │
              GitHub API → StoryFacts JSON  │  src/lib/github.ts
              OpenRouter → 6-scene script   │  src/lib/script.ts
              Kokoro-82M → per-scene WAVs   │  src/lib/tts.ts
              scene JSON → HyperFrames HTML │  src/lib/compose.ts
              headless Chrome → MP4         │  src/lib/render.ts
              review / cancel / refresh     │  src/lib/review.ts, src/lib/queue.ts
              retention sweep + cleanup     │  src/lib/retention.ts, src/lib/files.ts
```

Everything is a plain file on disk under `data/jobs/<id>/` — the facts, the script, the composition HTML, the final MP4, its poster, and the `.srt`. Intermediate audio and frame captures are removed once the MP4 exists. Delete the directory and the reel never existed.

## Model declaration

Built with **Claude (Fable 5)** as the coding agent. At runtime, video scripts are generated via OpenRouter (Claude Sonnet 4.5, with Gemini 2.5 Flash and GPT-4o-mini as fallbacks). Voiceover is local Kokoro-82M. All code in this repository was written during the Yard #1 build window (2026-08-28 18:00 → 2026-08-30 18:00 UTC).

## License

MIT
