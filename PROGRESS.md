# Huashu Keynote integration
Status: complete; PR ready for review

- [x] Optional renderer connected to UI, CLI, API options and produce().
- [x] TypeScript clean; 25 Bun tests and 2 Python lifecycle tests pass.
- [x] Browser selector, persistence and style controls verified.
- [x] Actual landscape, vertical and square output checked; previews retained.
- [x] Narrated Hermes × Zouroboros proof rendered through produce(): 832 frames, 27.733 seconds, 9 captions, H.264/AAC, poster and SRT.
- [x] Setup, source revision, attribution and measured rendering cost documented.
- [x] Specialist advice/review routing: shadow mode; no model calls.
- [x] Source pushed to feat/huashu-keynote-renderer; PR #8.

PR: https://github.com/marlandoj/reporeel/pull/8
Durable sample: docs/examples/hermes-keynote.mp4 (with .srt and .jpg).
Rollback: select Hyperframes; no service or database migration was made.
Deployment remains a separate step; no production services changed.

Validation notes: graph secure IPC was unavailable; the Zo operation-window gate could not write /home/.z in this VPS sandbox. The installed Hyperframes dependency's hardcoded TTS cache paths were redirected to /tmp for validation only; no dependency patch ships. Browser/model caches and intermediate renders stayed under /tmp.
