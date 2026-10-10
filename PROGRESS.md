# RepoReel site deployment
Status: blocked — deployment access unavailable; readiness audit not cleared

- [x] Combine existing site PR #11 and launch controls PR #9 on deploy/reporeel-site.
- [x] Frozen dependencies, TypeScript clean, 30 Bun and 2 Python tests passed.
- [x] Isolated HTTP smoke: site, studio, health, captions, video seeking, disabled generation.
- [x] Run production-ready skill and preserve original report with source-based triage.
- [x] Preserve deployment handoff and rollback guidance in deploy/readiness/REVIEW.md.
- [ ] Resolve remaining audit findings and missing scanner/runtime coverage.
- [ ] Install dedicated service and HTTPS route from a session with deployment access.
- [ ] Verify live URL and lifecycle before declaring deployed.

Blocker: sandbox forbids system writes and sudo; no privilege escalation is available.
Blocker: audit did not clear public launch; review and coverage work remains.

Next: use deploy/readiness/REVIEW.md. No production changes, provider calls or generation activation occurred.
