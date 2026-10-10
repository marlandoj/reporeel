# Deployment readiness review

Status: BLOCKED — not deployed; no production service or networking changes.

Candidate combines site PR #11 (0236398) and launch controls PR #9 (9f9ad73)
without merging either into main. The skill PR #10 is independent.

## Verified

- Bun 1.4.0 frozen dependency installation, clean TypeScript, 30 Bun tests and 2 Python tests.
- Isolated full-server HTTP checks: homepage, studio, health, captions, unknown asset rejection,
  MP4 byte ranges, and generation-disabled POST returning 503. See smoke.json.
- No provider credentials supplied or paid calls made. Temporary server stopped.
- Existing deployment templates retain a dedicated service identity and paths,
  loopback listener, generation disabled and zero daily provider allowance.

## Audit interpretation

The production-ready skill was run with all domains and deterministic triage.
The original outputs are retained unchanged. Its automated verdict is **Do Not Launch**;
this review does not override it or certify public readiness.

Four critical SQL findings in src/lib/queue.ts:38,44,58,64 are false positives on
inspection: ACTIVE_SQL is constructed exclusively from the fixed ACTIVE_STATUSES
array in src/lib/db.ts; PENDING_SQL adds the literal `review`. URL, variant, job ID,
and timestamp values use SQLite bound parameters. No request input reaches those
interpolated SQL fragments.

The high missing-rate-limit-library finding does not recognize custom controls.
submitJob enforces per-IP admission limits and bounded pending work; controls.ts
reserves durable daily provider attempts; STE and rewrite paths have dedicated
limits. Integration tests exercise spoofed IPs, concurrency, retry accounting,
restart persistence, stop behavior and queue resumption. This does not establish
edge-level request/body limits: the actual HTTPS proxy still needs configuration
and validation.

Five high empty-catch findings require explicit review before enabling generation:
ui.ts:309/310 ignore preference storage failures; :323 silently loses ownership-token
persistence; :669 hides polling failures; :721 hides example-list failures. The
ownership-token and polling cases can leave users unable to manage a job or unaware
of a stalled connection. Do not mark these resolved based on passing tests.

Coverage remains insufficient for public launch: gitleaks, semgrep and osv-scanner
are unavailable; no deployed URL/browser audit or critical manual sign-off exists.
Additional findings include missing privacy/terms pages and monitoring evidence.

## Deployment access blocker

The execution session permits writes only under the workspace and /tmp. It cannot
install /etc systemd/proxy configuration, create the service account or dedicated
/opt and /var service directories. sudo is blocked by no-new-privileges. Do not
circumvent this via alternate process launch or loopback SSH.

Read-only host inspection found port 3901 free and adequate idle headroom for a
paused site, but no render capacity benchmark was performed. Existing HTTPS
routes are Tailscale-only and belong to other applications; none were changed.

## Next authorized deployment session

1. Resolve the audit findings and run missing scanners plus runtime/browser checks.
   Preserve the raw report and add dated review evidence; do not silently relabel it.
2. Use deploy/README.md and the service/environment templates to provision the
   dedicated account and paths in a host session with deployment permissions.
3. Install the tested revision with frozen dependencies and Bun 1.4.0. Keep
   RENDER_DISABLED=1 and REPOREEL_AI_DAILY=0; no provider key is needed for showcase.
4. Verify loopback health, home/studio, video ranges/captions, disabled paid paths,
   unit restart and SQLite persistence as the dedicated account.
5. Select an available HTTPS hostname through the existing authorized mechanism;
   enforce body limits and overwrite X-Real-IP, then configure exact trusted peers.
   Keep Bun bound to loopback and preserve all existing service routes.
6. Verify the actual URL and logs. Name the HTTPS route as the consumer of the
   RepoReel loopback service. Enable the unit only after these checks pass.
7. Movie generation is a subsequent activation step requiring service-specific
   provider configuration, monetary/request limits and end-to-end render QA.

Rollback: stop only reporeel, remove only its newly added proxy route, and retain
its SQLite/media state. Record the deployed commit, prior route configuration,
public URL and successful rollback probe before declaring completion.
