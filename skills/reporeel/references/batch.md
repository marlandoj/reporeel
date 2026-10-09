# Repository portfolio workflow

Use when the operator requests a named list or all their repositories. Planning
a future portfolio does not authorize starting a portfolio run today.

Enumerate through authenticated `gh api --paginate users/OWNER/repos` (public
repos), or `gh api --paginate user/repos?affiliation=owner` when the operator has
requested inventory including private repos. Record visibility, archived/fork
status and default branch. Keep private repositories out of rendering pending a
separately scoped private-source workflow. If the user means owned, non-archived
projects, state that selection; do not silently include forks or archived repos.

Maintain a durable per-repository ledger with:

- owner/repo, visibility, source revision or release tag;
- format, renderer, style, grounding, captions, RepoReel revision;
- job directory, bundle directory, manifest checksum;
- state: planned, rendering, rendered, packaged, awaiting-upload, embedded,
  playback-verified, PR-open, merged, failed;
- attachment URL, branch, PR URL, failure detail and next action.

Render sequentially by default: local Chromium/ffmpeg and TTS are resource-heavy.
Do a single representative movie first, then continue the authorized list with
that accepted treatment. Use the host's managed job/factory mechanism when the
portfolio cannot fit in a chat turn; never start detached untracked render loops.

Skip a verified existing movie only when source revision and render options
match. On interruption, inspect job outputs and the remote branch/PR before retry.
Never overwrite a previous job or repeat an attachment upload merely because the
README operation failed. Keep failures per repository; stop for shared runtime,
credential or rate-limit failures. Retry only after resolving the cause.

README changes belong in one PR per target repository unless the user asks for
another delivery mode. A render request does not imply permission to merge every
PR. Report counts by state, links to review, and the exact pending upload/playback
steps. A packaged file is not a published movie.
