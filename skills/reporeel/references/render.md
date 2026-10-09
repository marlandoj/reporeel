# Runtime and rendering

Requirements: Bun and installed RepoReel dependencies, Python 3.10+, ffmpeg and
ffprobe (libx264/AAC), Chromium, and the app's Hyperframes/Kokoro TTS setup.
Keynote also needs the operator-managed Huashu checkout, Python Playwright and
Chromium from `$REPOREEL_ROOT/docs/huashu.md`. Respect its pinned engine revision
and font licenses. This skill does not deploy a server or configure providers.

From the application root, `bun install --frozen-lockfile` installs dependencies.
`OPENROUTER_API_KEY` is required for script generation. `GITHUB_TOKEN` is optional;
the application falls back to authenticated `gh`. Use `gh auth status` to check
access. `HUASHU_ROOT` and optionally `HUASHU_PYTHON` locate the Keynote engine.
Check presence without echoing credentials. Resolve missing runtime setup before
starting a portfolio; do not repeatedly run jobs against a broken provider.

Choose an absolute, unused `JOB_DIR` before invoking the CLI. Arguments start with
the source URL; the current CLI parser expects it before flag values.

```bash
cd "$REPOREEL_ROOT"
bun src/cli.ts https://github.com/OWNER/REPO \
  --format landscape --grounding both --renderer huashu-keynote \
  --captions --out-dir "$JOB_DIR"
```

For a requested alternative style:

```bash
bun src/cli.ts https://github.com/OWNER/REPO \
  --renderer hyperframes --style terminal --format landscape \
  --grounding both --captions --out-dir "$JOB_DIR"
```

Other supported inputs include `/pull/123`, `/releases/tag/v1.2.3`,
`OWNER/REPO@v1.2.3`, `/releases/latest`, and `/compare/v1.2...v1.3`.
Do not invent duration/voice flags; this CLI currently exposes neither.

Outputs include `facts.json`, `script.json`, `warnings.json`, `out.mp4`,
`poster.jpg`, and `out.srt` (when captions are enabled). CLI stdout ends with a
JSON result containing the MP4 path, title, duration, canonical source and warnings.
A failed process is not a finished movie, even if partial files exist.

Capture the source's current revision with `gh api repos/OWNER/REPO/commits/HEAD
--jq .sha` before and after a default-branch render. If they differ, label the
render stale and decide whether it needs regeneration. That check records a
revision window; it does not make RepoReel's live repository ingestion atomic.
Keep job facts and options with the batch record. Movie packaging alone does not
invoke a model provider or TTS.
