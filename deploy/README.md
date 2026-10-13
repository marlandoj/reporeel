# Existing-VPS deployment preparation

These files are templates, not an installed or verified deployment. Keep generation
disabled until host checks, runtime QA, key placement and a spending limit are approved.

## First inspect the selected existing host

Historical host: ubuntu-4gb-hel1-4 at Tailscale 100.69.35.3.
Use the authorized existing SSH key in place; never copy it. Connect with ordinary
SSH host-key checking and verify the existing known_hosts identity. Do not use
StrictHostKeyChecking=no, overwrite a changed host key, or silently trust a new one.

Before installing anything, inspect hostname, OS/architecture, CPU/RAM/swap,
free disk, current load, listening ports, running containers and systemd services.
Confirm the VPS is the intended Zouroboros host. Check whether port 3901 is free
and whether CPU/memory/storage headroom exists. Do not restart, rename, reconfigure,
or reuse data directories or credentials from existing Zouroboros services.

The historical machine has 4 GB RAM. The service template limits RepoReel to one
CPU and 2 GB RAM, with low scheduling priority. These are conservative initial
limits requiring a real render benchmark; they are not proof that rendering fits.
If headroom is inadequate, keep the service stopped and report measured capacity.

## Isolated installation after inspection

Use a dedicated unprivileged reporeel account, code under /opt/reporeel/code,
a dedicated Bun executable at /opt/reporeel/bin/bun, SQLite and jobs under
/var/lib/reporeel, and browser/model caches under /var/cache/reporeel.
Never give the service access to root's home, SSH agent, gh configuration, or other
services' environment files. Use the reviewed branch/commit in a separate checkout.

Install the exact Bun version used by CI and dependencies with
bun install --frozen-lockfile. Provision ffmpeg and all Chromium shared libraries
from trusted distribution/vendor sources only after checking existing packages.
HyperFrames downloads Chromium and Kokoro assets; verify their cache paths,
permissions and operation as the service account. PROGRESS.md records previous
dependency cache-path issues, so do not assume HOME/XDG_CACHE_HOME suffice.

Copy reporeel.env.example to /etc/reporeel/reporeel.env with root ownership and
mode 0600, preserving RENDER_DISABLED=1 and REPOREEL_AI_DAILY=0.
Do not add any key yet. Adjust the unused port only after inspecting listeners.
Review and install reporeel.service as a new unit. Do not enable it automatically
until loopback health and process restart checks pass. Store no keys in Git.

## Controls and emergency stop

RENDER_DISABLED (any nonempty value) pauses new jobs, approvals, forced refresh,
scene rewrites, STE rewrites, queued work and provider attempts.
Creating /var/lib/reporeel/STOP_GENERATION triggers the same stop at runtime,
without a restart. In-flight provider fetches are aborted and directly spawned
renderer/TTS processes receive kill signals within roughly 250 ms. Provider
requests already accepted can still be billed; this is not a refund mechanism.
Child subprocess trees may outlive a direct child kill. For a full process-tree
stop use systemctl stop reporeel; KillMode=control-group stops only this unit.
Retain the stop file before restarting to prevent automatic resumption.

Do not remove the stop file or unset RENDER_DISABLED until explicitly ready to
resume. Interrupted jobs may fail and require resubmission. The SQLite startup
recovery retains its existing behavior, but the worker does not run paused jobs.

Every OpenRouter attempt, including fallback/retry, consumes a durable daily
REPOREEL_AI_DAILY reservation shared by all features. The default is zero
(fail closed); this is a request allowance, not a dollar cap. Use an approved,
service-specific OpenRouter key with a provider-enforced monetary limit as well.
STE has a separate durable daily allowance and per-IP cooldown.
Malformed/negative limits fail closed. Limits use UTC days and survive restarts.

## Public access requires separate network approval

The app binds loopback by default. No firewall, DNS, TLS, proxy or Tailscale
configuration has been changed by this preparation.
Select an existing approved HTTPS reverse proxy and available hostname before
proposing the exact networking changes. It must overwrite X-Real-IP with the
actual client address, never append/pass a visitor-provided value. Configure
REPOREEL_TRUSTED_PROXIES to its exact socket peer IP(s) only. X-Forwarded-For is
ignored. Keep the Bun port unreachable by public clients. Apply a request-body
limit at the proxy and configure TLS through the approved existing mechanism.

## Validation before calling the deployment functional

Run typecheck and all Bun/Python tests on the exact deployed revision.
With generation paused, verify loopback /healthz, home page, STE lint, all paid
entrypoints returning 503, and persistence across service restart.
After approved key/budget configuration and unpausing, render a public repository
with review, edit/regenerate one scene, approve, and verify narration, MP4 playback,
range downloads, poster, captions/SRT and share page. Repeat health/load inspection
during rendering to confirm Zouroboros remains healthy.
Verify per-IP spoofing resistance through the actual proxy, exhausted daily
allowance, queue bounds, restart persistence, live stop and full unit stop.
Back up SQLite using its backup API or a consistent stopped-service copy including
WAL state, and back up media separately. Keep restore and rollback confined to
RepoReel paths. Public URL verification is still required.
