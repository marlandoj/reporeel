# RepoReel

**Paste a public GitHub repo URL. Get a narrated explainer video. No accounts.**

Live: **https://reporeel-marlandoj.zocomputer.io**

Built solo in 48 hours for [Hackyard Yard #1](https://hackyard.tech/yards/yard-1) — theme: **"No accounts."**

## What it does

Give RepoReel any public GitHub repository (or pull request) URL and it produces a ~60 second narrated explainer video, on the spot:

1. **Ingest** — pulls the repo's real metadata, README, languages, and commit history from the GitHub API. For PRs: the diff stats and changed files.
2. **Script** — an LLM turns those facts into a 6-scene video script with on-screen copy and a continuous voiceover, grounded in the fetched data.
3. **Voice** — narration is synthesized locally with Kokoro-82M (no cloud TTS).
4. **Render** — the scenes are compiled into a [HyperFrames](https://github.com/heygen-com/hyperframes) HTML composition (GSAP timeline, per-scene audio) and rendered headlessly to MP4.

The finished reel lives at a shareable `/v/:id` link and can be downloaded as a plain MP4. Typical end-to-end time: about 90 seconds.

## Theme fit: no accounts, honestly

- No sign-up, no login, no email — not for making videos, not for watching them, not for downloading them.
- No cookies, no tracking, no user identity of any kind. The server keeps a job queue and nothing about *you*.
- Abuse control without identity: per-IP rate limiting (3 new videos/hour), a bounded queue, and URL-level caching so popular repos render once.

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

One-off CLI render, no server:

```bash
bun src/cli.ts https://github.com/owner/repo
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
```

Everything is a plain file on disk under `data/jobs/<id>/` — the facts, the script, the audio, the composition HTML, and the final MP4. Delete the directory and the reel never existed.

## Model declaration

Built with **Claude (Fable 5)** as the coding agent. At runtime, video scripts are generated via OpenRouter (Claude Sonnet 4.5, with Gemini 2.5 Flash and GPT-4o-mini as fallbacks). Voiceover is local Kokoro-82M. All code in this repository was written during the Yard #1 build window (2026-08-28 18:00 → 2026-08-30 18:00 UTC).

## License

MIT
