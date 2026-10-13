# GitHub README video publication

GitHub's attachment uploader returns URLs such as
`https://github.com/user-attachments/assets/<uuid>`. Put the returned video URL
on its own line in Markdown for GitHub's attachment player. The helper also
accepts legacy `https://user-images.githubusercontent.com/.../*.mp4` video URLs.
A URL that matches this shape could still be an image or a missing attachment:
verify the actual rendered player, not only the URL.

GitHub documents a 10 MB video limit for free plans and larger limits for eligible
paid plans. This skill defaults to 9.5 MB for portability and H.264/AAC for browser
compatibility. See [GitHub's attachment documentation](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files).

1. Prepare and inspect `movie.mp4`. Uploading exposes its contents to the target
   audience, so use only the approved movie. Do not publish raw job facts or logs.
2. Open the target README in GitHub's authenticated browser editor on the intended
   branch. Drag/upload the movie, wait for upload completion, and capture the
   resulting attachment URL. Upload happens immediately; saving the README is a
   separate action. Reuse this URL if a later README commit fails.
3. Apply the managed block locally using `embed --write`, inspect `git diff`,
   commit and open/update the requested PR. Avoid making a second browser commit
   if the local branch is the source of the change.
4. Open the README's rendered preview for that branch. Start the movie, confirm
   video and audio playback, and verify access for the intended audience.

The authenticated `gh` CLI handles repository reads, branches and PR operations;
it has no documented attachment-upload command. Browser upload or an
operator-supplied attachment URL is therefore required for the native player.
Do not automate GitHub's internal endpoints or treat a release upload as equivalent.

If browser upload is unavailable, provide the prepared file and exact remaining
step. An explicitly accepted alternative is a poster linked to a durable movie
page/release asset, but that is click-through playback, not an inline README
player. Do not silently downgrade the user's requested experience. Avoid using
RepoReel's temporary job URLs as permanent documentation assets: its server has
an automatic retention policy (30 days by default).

Optionally commit the small poster, captions and transcript under `docs/media/`
and link them near the player after review. Do not commit large rendered videos
into every repository by default. Preserve existing licenses and attribution.
