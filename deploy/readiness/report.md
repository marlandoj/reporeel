# Production-Readiness Audit

**Generated:** 2026-10-10T01:11:30.145Z
**App:** RepoReel — Repository movie showcase and creation studio
**Repo:** `/opt/zouroboros/repo/Projects/reporeel-deploy/reporeel`
**Audit duration:** 0.4s

## Verdict — 🔴 Do Not Launch

> 4 hard blocker(s) and/or critical finding(s) detected

| Severity | Count |
|----------|-------|
| 🔴 Critical | 4 |
| 🟠 High | 6 |
| 🟡 Medium | 8 |
| 🔵 Low | 15 |
| ⚪ Info | 0 |

## Coverage

> ⚠️ This audit was **incomplete** — coverage gaps cap the verdict at **Private Beta Only**. A clean result here means "no problems found in what we could inspect", not "safe to launch".

**Coverage gaps:**

- • soft — secrets ran with reduced coverage — ran without gitleaks, trufflehog
- • soft — authentication ran with reduced coverage — ran without semgrep
- • soft — owasp ran with reduced coverage — ran without semgrep, osv-scanner
- • soft — browser-test could not be exercised — no --url provided; runtime browser behavior was not exercised
- • soft — concurrency ran with reduced coverage — static heuristics only; race conditions need runtime confirmation
- • soft — visual-consistency ran with reduced coverage — no URL — static heuristics only, no rendered inspection
- • soft — seo-aeo ran with reduced coverage — no audit URL provided; repo heuristics only — live crawl/index signals not verified
- 🚧 **blocking** — 3 core scanners unavailable (gitleaks, semgrep, osv-scanner) — external verification is largely absent; only in-process heuristics ran
- • soft — 5 critical manual check(s) not signed off — pass --manual-verified after a human confirms them

| Domain | Coverage |
|--------|----------|
| Legal & Data Handling | ✅ Full |
| Secrets & Credential Exposure | 🟡 Partial — ran without gitleaks, trufflehog |
| Authentication & Authorization | 🟡 Partial — ran without semgrep |
| API Route Safety | ✅ Full |
| OWASP Baseline | 🟡 Partial — ran without semgrep, osv-scanner |
| Abuse, Cost & Rate Limits | ✅ Full |
| Frontend Exposure | ✅ Full |
| Logging & Monitoring | ✅ Full |
| Accessibility | ✅ Full |
| Performance & Reliability | ✅ Full |
| Payments & Webhooks | ✅ Full |
| File Upload Safety | ✅ Full |
| Database & Data Access | ✅ Full |
| AI-Generated Code Failure Modes | ✅ Full |
| Browser Testing | 🔴 None — no --url provided; runtime browser behavior was not exercised |
| Concurrency & State Integrity | 🟡 Partial — static heuristics only; race conditions need runtime confirmation |
| Visual Consistency | 🟡 Partial — no URL — static heuristics only, no rendered inspection |
| seo-aeo | 🟡 Partial — no audit URL provided; repo heuristics only — live crawl/index signals not verified |

## 🚨 Hard Blockers — must fix before launch

- **SQL query built via string concatenation/interpolation** — database — `db.sql-concat.src/lib/queue.ts.38`
- **SQL query built via string concatenation/interpolation** — database — `db.sql-concat.src/lib/queue.ts.44`
- **SQL query built via string concatenation/interpolation** — database — `db.sql-concat.src/lib/queue.ts.58`
- **SQL query built via string concatenation/interpolation** — database — `db.sql-concat.src/lib/queue.ts.64`

## Remediation shape

### 🔧 Targeted code changes — 5

- 🟡 **Read-modify-write with no transaction / optimistic lock** — `concurrency.lost-update.tests/controls-runner.ts`
- 🟡 **Read-modify-write with no transaction / optimistic lock** — `concurrency.lost-update.src/lib/controls.ts`
- 🟡 **Read-modify-write with no transaction / optimistic lock** — `concurrency.lost-update.src/lib/review.ts`
- 🔵 **No JSON-LD structured data in any template** — `seo-aeo.repo-missing-jsonld`
- 🔵 **noindex directive in template: lib/ste100page.ts** — `seo-aeo.repo-noindex-template.L29wdC96b3Vy`

## Tooling

| Tool | Available | Version |
|------|-----------|---------|
| `gitleaks` | ❌ | — |
| `trufflehog` | ❌ | — |
| `semgrep` | ❌ | — |
| `osv-scanner` | ❌ | — |
| `trivy` | ❌ | — |
| `lighthouse` | ❌ | — |
| `axe` | ❌ | — |
| `pa11y` | ❌ | — |
| `nuclei` | ❌ | — |

## Findings by domain

### Legal & Data Handling

*Ran in 0.02s with: production-ready:repo-grep*

#### 🟡 No privacy policy page found

*MEDIUM — production-ready:repo-grep*

No file or route resembling a privacy policy was detected. Apps that collect user data need a published, accessible privacy policy.

**Fix:**

Add `/privacy` (or similar) describing what data you collect, why, how long it's retained, third parties it's shared with, and how users can export/delete it.

**References:** <https://gdpr.eu/article-13-notice/>, <https://oag.ca.gov/privacy/ccpa>

#### 🟡 No terms of service found

*MEDIUM — production-ready:repo-grep*

No file or route resembling Terms of Service was detected. Public-facing apps should publish ToS limiting liability and defining acceptable use.

**Fix:**

Add `/terms` covering acceptable use, liability disclaimers, dispute resolution, and termination conditions.

**Manual review for this domain:**

- [ ] List every third party that receives user data (analytics, error reporting, LLM providers, payment processors)
  - *why:* Required for GDPR/CCPA disclosure and Data Processing Agreements.
- [ ] Define data retention windows per data type
  - *why:* Indefinite retention is hostile to user privacy and increases breach blast radius.
- [ ] Verify Data Processing Agreement (DPA) signed with each sub-processor
  - *why:* GDPR Article 28 requires DPAs with processors handling personal data.
- [ ] Cookie banner / consent management is wired (if EU/UK users)
  - *why:* GDPR + ePrivacy Directive require informed consent for non-essential cookies.
- [ ] Privacy policy lists all processors + retention windows + lawful basis
  - *why:* Plain-language disclosure is legally required, not optional.

---

### Secrets & Credential Exposure

*Ran in 0.08s with: none*

> Missing tools: `gitleaks`, `trufflehog`

✅ No findings in this domain.
**Manual review for this domain:**

- [ ] Confirm publishable/anon keys are documented as intentionally-public by the provider
  - *why:* Some 'public' keys are safe to expose (Stripe publishable, Supabase anon); others are not.
- [ ] Verify credential rotation cadence is defined and tested
  - *why:* Even unleaked credentials should be rotated periodically.
- [ ] Check provider audit logs for unexpected access
  - *why:* Past leaks may have been exploited.

---

### Authentication & Authorization

*Ran in 0.02s with: none*

> Missing tools: `semgrep`

✅ No findings in this domain.
**Manual review for this domain:**

- [ ] Test ownership boundaries — sign in as user A, try to access user B's resources via direct URL
  - *why:* BOLA / IDOR is the #1 API vuln per OWASP API Top 10 2023.
- [ ] Verify MFA is available (and required for admin)
  - *why:* Compromised passwords are the most common breach vector.
- [ ] Confirm session timeout + inactivity logout exists
  - *why:* Long-lived sessions on shared/public devices are a leak path.
- [ ] Check rate limit on login + password reset endpoints
  - *why:* Credential stuffing & enumeration require throttling.

---

### API Route Safety

*Ran in 0.04s with: production-ready:repo-grep*

#### 🟠 No rate-limiting middleware detected

*HIGH — production-ready:rate-limit-grep*

Detected 15 API handlers but no rate-limiting library is imported anywhere. Public APIs without rate limits invite credential stuffing, scraping, and billing abuse.

**Fix:**

Add a rate limiter at the edge or middleware layer (express-rate-limit, @upstash/ratelimit, or your platform's WAF). Limit per IP AND per user. Apply stricter limits to auth/password-reset routes.

**References:** <https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/>

**Manual review for this domain:**

- [ ] Verify every state-changing endpoint requires POST/PUT/PATCH/DELETE (not GET)
  - *why:* GET requests are logged in browser history, referrer headers, and CDN logs.
- [ ] Confirm OpenAPI/Swagger spec exists and matches implementation
  - *why:* Drift between docs and code hides shadow endpoints.
- [ ] Test rate limits return 429 with a Retry-After header
  - *why:* Some implementations silently drop; clients need feedback.

---

### OWASP Baseline

*Ran in 0.01s with: none*

> Missing tools: `semgrep`, `osv-scanner`

✅ No findings in this domain.
**Manual review for this domain:**

- [ ] Threat-model the auth boundary: what does a malicious authenticated user gain access to?
  - *why:* OWASP A04 (Insecure Design) cannot be detected by scanners — needs human judgement.
- [ ] Review every dependency added in the last 6 months for typosquatting / abandoned-maintainer risk
  - *why:* Supply-chain attacks (A08) target recently-added or unmaintained packages.
- [ ] Run a real DAST (ZAP full scan) at least once before launch and after every major release
  - *why:* Static analysis cannot replicate exploit paths.

---

### Abuse, Cost & Rate Limits

*Ran in 0.02s with: production-ready:abuse-grep*

✅ No findings in this domain.
**Manual review for this domain:**

- [ ] Confirm a per-tenant daily/monthly cost cap is enforced at the application layer
  - *why:* Rate limits alone don't prevent a single bad actor from draining a budget within their quota.
- [ ] Bot/CAPTCHA on signup + login + 'forgot password'
  - *why:* Most abuse arrives via cheap-account creation.
- [ ] Billing-anomaly alert wired to ops channel
  - *why:* Catch runaway costs in minutes not days.

---

### Frontend Exposure

*Ran in 0.01s with: production-ready:bundle-scan*

#### 🔵 Internal URL / IP hardcoded in source

*LOW — production-ready:internal-url-grep*

Hard-coded internal hostnames or IPs end up in the production bundle and may reveal architecture details to attackers.

**Evidence:**

- `tests/controls-runner.ts:47`
  ```
  process.env.REPOREEL_TRUSTED_PROXIES = "127.0.0.1";
  ```

**Fix:**

Move URLs to environment-driven config. Verify the build pipeline strips dev-only paths.

#### 🔵 Internal URL / IP hardcoded in source

*LOW — production-ready:internal-url-grep*

Hard-coded internal hostnames or IPs end up in the production bundle and may reveal architecture details to attackers.

**Evidence:**

- `tests/controls-runner.ts:48`
  ```
  assert.equal(visitorIp("127.0.0.1", headers), "203.0.113.9");
  ```

**Fix:**

Move URLs to environment-driven config. Verify the build pipeline strips dev-only paths.

#### 🔵 Internal URL / IP hardcoded in source

*LOW — production-ready:internal-url-grep*

Hard-coded internal hostnames or IPs end up in the production bundle and may reveal architecture details to attackers.

**Evidence:**

- `tests/controls-runner.ts:49`
  ```
  assert.equal(visitorIp("::ffff:127.0.0.1", headers), "203.0.113.9");
  ```

**Fix:**

Move URLs to environment-driven config. Verify the build pipeline strips dev-only paths.

#### 🔵 Internal URL / IP hardcoded in source

*LOW — production-ready:internal-url-grep*

Hard-coded internal hostnames or IPs end up in the production bundle and may reveal architecture details to attackers.

**Evidence:**

- `tests/controls-runner.ts:50`
  ```
  assert.equal(visitorIp("127.0.0.1", new Headers({ "x-real-ip": "a,b" })), "127.0.0.1");
  ```

**Fix:**

Move URLs to environment-driven config. Verify the build pipeline strips dev-only paths.

#### 🔵 Internal URL / IP hardcoded in source

*LOW — production-ready:internal-url-grep*

Hard-coded internal hostnames or IPs end up in the production bundle and may reveal architecture details to attackers.

**Evidence:**

- `tests/controls-runner.ts:123`
  ```
  return app.fetch(new Request("http://localhost" + path, {
  ```

**Fix:**

Move URLs to environment-driven config. Verify the build pipeline strips dev-only paths.

**Manual review for this domain:**

- [ ] Open DevTools → Network tab on the production app — is any request going to a dev/staging URL?
  - *why:* AI-generated code commonly leaves mixed-environment URLs after a copy-paste.
- [ ] Check the bundle for comments / console.log statements
  - *why:* Debug output may leak request/response shapes and PII.

---

### Logging & Monitoring

*Ran in 0.03s with: production-ready:logger-grep*

#### 🟡 No structured logger detected

*MEDIUM — production-ready:logger-grep*

Unstructured logs are harder to search, redact, and rate-limit. They cost more in centralized log stores.

**Fix:**

Adopt pino (Node), structlog (Python), zap/slog (Go). Configure built-in PII redaction. Tag every log with request_id, user_id (hashed), tenant_id.

#### 🟡 No error tracker integration detected

*MEDIUM — production-ready:tracker-grep*

Unobserved errors are unfixed errors. Without Sentry/Bugsnag/Datadog, you find out about prod issues from angry users.

**Fix:**

Wire Sentry (or equivalent) on both client and server. Set release/environment tags. Configure source-map upload.

**References:** <https://docs.sentry.io/>

**Manual review for this domain:**

- [ ] Verify centralized logs are searchable for at least 7 days
  - *why:* Incidents are often noticed after they end; you need retention to retro.
- [ ] Confirm uptime monitor with on-call paging (StatusCake / BetterStack / Pingdom)
  - *why:* External probe catches what your internal metrics can't.
- [ ] Per-tenant audit trail for: auth events, permission changes, admin actions, data exports
  - *why:* Required for SOC 2 + GDPR + breach forensics.

---

### Accessibility

*Ran in 0.00s with: none*

✅ No findings in this domain.
**Manual review for this domain:**

- [ ] Keyboard-only pass: can you reach every interactive control with Tab? Operate it with Enter/Space?
  - *why:* Automated tools catch ~30–40% of WCAG issues; keyboard ops can't be inferred from DOM.
- [ ] Screen reader smoke test (VoiceOver / NVDA): does the announcement order make sense?
  - *why:* Visually-ordered DOM can confuse screen readers.
- [ ] Reduced motion preference is honored
  - *why:* WCAG 2.3.3 (Animation from Interactions) and motion-disorder users.

---

### Performance & Reliability

*Ran in 0.00s with: none*

✅ No findings in this domain.
**Manual review for this domain:**

- [ ] Tested rollback procedure in staging within last 30 days
  - *why:* An untested rollback is a hope, not a plan.
- [ ] Backups exist AND restore has been tested in last 90 days
  - *why:* Schrödinger's backup: simultaneously exists and doesn't until verified.
- [ ] Capacity tested at ≥ 2× projected peak traffic
  - *why:* Launch traffic spikes are bigger than steady state.
- [ ] Per-route SLOs defined with error budget tracking
  - *why:* Reliability targets without budgets become aspirations.

---

### Payments & Webhooks

*Ran in 0.01s with: none*

✅ No findings in this domain.
**Manual review for this domain:**

- [ ] Confirm app has no money-handling surface
  - *why:* If payments appear later, re-run this check.

---

### File Upload Safety

*Ran in 0.01s with: none*

✅ No findings in this domain.
**Manual review for this domain:**

- [ ] No upload code detected — confirm app does not accept user uploads.
  - *why:* Re-run when uploads are added.

---

### Database & Data Access

*Ran in 0.01s with: production-ready:db-grep*

#### 🔴 SQL query built via string concatenation/interpolation (HARD BLOCKER)

*CRITICAL — production-ready:sql-concat-grep*

Concatenating user input into SQL is the textbook SQL-injection vector.

**Evidence:**

- `src/lib/queue.ts:38`
  ```
  query(`SELECT id FROM jobs WHERE canonical = ? AND variant = ? AND status IN (${PENDING_SQL}) LIMIT 1`
  ```

**Fix:**

Use parameterised queries (`?` / `$1` placeholders) or an ORM. Never concatenate untrusted input into SQL.

**References:** <https://owasp.org/Top10/A03_2021-Injection/>, <https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html>

#### 🔴 SQL query built via string concatenation/interpolation (HARD BLOCKER)

*CRITICAL — production-ready:sql-concat-grep*

Concatenating user input into SQL is the textbook SQL-injection vector.

**Evidence:**

- `src/lib/queue.ts:44`
  ```
  query(`SELECT COUNT(*) as n FROM jobs WHERE status IN (${PENDING_SQL})`
  ```

**Fix:**

Use parameterised queries (`?` / `$1` placeholders) or an ORM. Never concatenate untrusted input into SQL.

**References:** <https://owasp.org/Top10/A03_2021-Injection/>, <https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html>

#### 🔴 SQL query built via string concatenation/interpolation (HARD BLOCKER)

*CRITICAL — production-ready:sql-concat-grep*

Concatenating user input into SQL is the textbook SQL-injection vector.

**Evidence:**

- `src/lib/queue.ts:58`
  ```
  query(`SELECT COUNT(*) as n FROM jobs WHERE status IN (${ACTIVE_SQL}) AND id != ? AND (status != 'queued' OR created_at < ?)`
  ```

**Fix:**

Use parameterised queries (`?` / `$1` placeholders) or an ORM. Never concatenate untrusted input into SQL.

**References:** <https://owasp.org/Top10/A03_2021-Injection/>, <https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html>

#### 🔴 SQL query built via string concatenation/interpolation (HARD BLOCKER)

*CRITICAL — production-ready:sql-concat-grep*

Concatenating user input into SQL is the textbook SQL-injection vector.

**Evidence:**

- `src/lib/queue.ts:64`
  ```
  query(`SELECT COUNT(*) as n FROM jobs WHERE status IN (${ACTIVE_SQL})`
  ```

**Fix:**

Use parameterised queries (`?` / `$1` placeholders) or an ORM. Never concatenate untrusted input into SQL.

**References:** <https://owasp.org/Top10/A03_2021-Injection/>, <https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html>

#### 🟡 10 queries appear to not filter by user/tenant column

*MEDIUM — production-ready:tenant-scope-grep*

Heuristic — queries without user_id/tenant_id/organization_id filters may be returning cross-tenant data. Review each.

**Evidence:**

- `tests/controls-runner.ts:69`
  ```
  const steUsed = (db.query("SELECT used FROM usage_limits WHERE scope='ste'").get() as { used: number }).used;
  ```
- `tests/controls-runner.ts:188`
  ```
  db.run("DELETE FROM usage_limits WHERE scope='ai'");
  ```
- `tests/controls-runner.ts:200`
  ```
  db.run("DELETE FROM usage_limits WHERE scope='ai'");
  ```
- `tests/controls-runner.ts:220`
  ```
  db.run("DELETE FROM usage_limits WHERE scope='ai'");
  ```
- `tests/controls-runner.ts:232`
  ```
  assert.equal((db.query("SELECT used FROM usage_limits WHERE scope='ai'").get() as { used: number }).used, 1);
  ```

**Fix:**

Every query on user-owned tables must filter by the requesting user/tenant. Consider a query-builder middleware that enforces this for you.

**References:** <https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/>

**Manual review for this domain:**

- [ ] Test backup restore in a scratch environment — actually restore, don't just dump
  - *why:* Backup files aren't backups; restored databases are.
- [ ] Database admin password rotation policy + last rotation date
  - *why:* Long-lived admin creds are a high-value target.
- [ ] Audit log captures: schema changes, role grants, admin queries, data exports
  - *why:* Required for SOC 2 + breach forensics.
- [ ] Confirm migrations are idempotent and tested in CI
  - *why:* AI-generated migrations frequently aren't reversible.

---

### AI-Generated Code Failure Modes

*Ran in 0.04s with: production-ready:ai-heuristics*

#### 🟠 Empty `catch` swallows errors

*HIGH — production-ready:ai-silent-catch-js*

JS/TS catch block is empty or comment-only — errors disappear.

**Evidence:**

- `src/lib/ui.ts:309`
  ```
  } catch (e) {}
  ```

**Fix:**

Log the error and either rethrow or handle it explicitly.

#### 🟠 Empty `catch` swallows errors

*HIGH — production-ready:ai-silent-catch-js*

JS/TS catch block is empty or comment-only — errors disappear.

**Evidence:**

- `src/lib/ui.ts:310`
  ```
  opts.renderer, style: opts.style, plain: opts.plain })); } catch (e) {} }
  ```

**Fix:**

Log the error and either rethrow or handle it explicitly.

#### 🟠 Empty `catch` swallows errors

*HIGH — production-ready:ai-silent-catch-js*

JS/TS catch block is empty or comment-only — errors disappear.

**Evidence:**

- `src/lib/ui.ts:323`
  ```
  id, t) { try { localStorage.setItem("rr-owner-" + id, t); } catch (e) {} }
  ```

**Fix:**

Log the error and either rethrow or handle it explicitly.

#### 🟠 Empty `catch` swallows errors

*HIGH — production-ready:ai-silent-catch-js*

JS/TS catch block is empty or comment-only — errors disappear.

**Evidence:**

- `src/lib/ui.ts:669`
  ```
  }).catch(function () {});
  ```

**Fix:**

Log the error and either rethrow or handle it explicitly.

#### 🟠 Empty `catch` swallows errors

*HIGH — production-ready:ai-silent-catch-js*

JS/TS catch block is empty or comment-only — errors disappear.

**Evidence:**

- `src/lib/ui.ts:721`
  ```
  }).catch(function () {});
  ```

**Fix:**

Log the error and either rethrow or handle it explicitly.

#### 🔵 Type-checker suppression

*LOW — production-ready:ai-type-suppression*

`as any` / `@ts-ignore` / `# type: ignore` silences the type checker without fixing the underlying issue.

**Evidence:**

- `tests/controls-runner.ts:166`
  ```
  assert.throws(() => approveJob(getJob(reel.id)!), e => (e as any).status === 429);
  ```

**Fix:**

Either fix the underlying type problem or add a justification comment with an issue number to track removal.

#### 🔵 Type-checker suppression

*LOW — production-ready:ai-type-suppression*

`as any` / `@ts-ignore` / `# type: ignore` silences the type checker without fixing the underlying issue.

**Evidence:**

- `tests/controls-runner.ts:176`
  ```
  it assert.rejects(() => rewriteScene(stale, 1, ""), e => (e as any).status === 409);
  ```

**Fix:**

Either fix the underlying type problem or add a justification comment with an issue number to track removal.

#### 🔵 Type-checker suppression

*LOW — production-ready:ai-type-suppression*

`as any` / `@ts-ignore` / `# type: ignore` silences the type checker without fixing the underlying issue.

**Evidence:**

- `tests/controls-runner.ts:177`
  ```
  assert.throws(() => saveScript(stale, script), e => (e as any).status === 409);
  ```

**Fix:**

Either fix the underlying type problem or add a justification comment with an issue number to track removal.

#### 🔵 Type-checker suppression

*LOW — production-ready:ai-type-suppression*

`as any` / `@ts-ignore` / `# type: ignore` silences the type checker without fixing the underlying issue.

**Evidence:**

- `tests/controls-runner.ts:178`
  ```
  assert.throws(() => approveJob(stale), e => (e as any).status === 409);
  ```

**Fix:**

Either fix the underlying type problem or add a justification comment with an issue number to track removal.

#### 🔵 Type-checker suppression

*LOW — production-ready:ai-type-suppression*

`as any` / `@ts-ignore` / `# type: ignore` silences the type checker without fixing the underlying issue.

**Evidence:**

- `tests/controls-runner.ts:184`
  ```
  it assert.rejects(() => rewriteScene(stale, 1, ""), e => (e as any).status === 429);
  ```

**Fix:**

Either fix the underlying type problem or add a justification comment with an issue number to track removal.

#### 🔵 Type-checker suppression

*LOW — production-ready:ai-type-suppression*

`as any` / `@ts-ignore` / `# type: ignore` silences the type checker without fixing the underlying issue.

**Evidence:**

- `tests/controls-runner.ts:192`
  ```
  (() => generateScript(facts, normalizeOptions({})), e => (e as any).status === 429);
  ```

**Fix:**

Either fix the underlying type problem or add a justification comment with an issue number to track removal.

#### 🔵 Type-checker suppression

*LOW — production-ready:ai-type-suppression*

`as any` / `@ts-ignore` / `# type: ignore` silences the type checker without fixing the underlying issue.

**Evidence:**

- `tests/controls-runner.ts:196`
  ```
  await assert.rejects(() => openRouterJson({}), e => (e as any).status === 503);
  ```

**Fix:**

Either fix the underlying type problem or add a justification comment with an issue number to track removal.

#### 🔵 Type-checker suppression

*LOW — production-ready:ai-type-suppression*

`as any` / `@ts-ignore` / `# type: ignore` silences the type checker without fixing the underlying issue.

**Evidence:**

- `tests/controls-runner.ts:205`
  ```
  await assert.rejects(() => openRouterJson({}), e => (e as any).status === 429);
  ```

**Fix:**

Either fix the underlying type problem or add a justification comment with an issue number to track removal.

**Manual review for this domain:**

- [ ] Diff every AI-generated commit against the previous state — focus on what was REMOVED, not just added
  - *why:* Agents commonly remove security checks during 'fixing' a test or unrelated bug.
- [ ] Spot-check tests by running them in --watch + deliberately breaking the SUT — do the tests fail?
  - *why:* Fake-passing tests reveal themselves when the code they 'test' actually breaks.
- [ ] Inspect every `if NODE_ENV === 'production'` branch — was the security check actually wired in prod?
  - *why:* AI often forgets to remove dev escape hatches.

---

### Browser Testing

*Ran in 0.00s with: none*

✅ No findings in this domain.
**Manual review for this domain:**

- [ ] Sign-in, sign-out, and 'forgot password' flow on desktop AND mobile viewport
  - *why:* Most common UX regression after AI-generated changes.
- [ ] **🔒 (gates launch)** Direct-URL access to authenticated routes when logged out — confirms server-side gating
  - *why:* Client-side guards are not enough.
- [ ] Mobile viewport check at 360×640 (iPhone SE size) — tap targets ≥ 44×44px
  - *why:* WCAG 2.5.5 + mobile users are typically your largest cohort.
- [ ] Form validation: try submitting empty, oversized, malformed, and SQL/XSS payloads
  - *why:* Validation gaps surface here that grep misses.
- [ ] Browser back/forward after sensitive actions (delete, purchase) — does state stay consistent?
  - *why:* AI often forgets history.replaceState; back-button reveals stale UI.
- [ ] Open DevTools Network tab during normal use — does any request go to localhost / staging?
  - *why:* Mixed-environment URLs leak through AI copy-paste.
- [ ] Check console for errors and warnings across 5+ representative flows
  - *why:* Production-only errors (e.g., CSP violations) usually surface here first.

---

### Concurrency & State Integrity

*Ran in 0.01s with: production-ready:concurrency-heuristics*

#### 🟡 Read-modify-write with no transaction / optimistic lock

*MEDIUM — production-ready:lost-update · confidence: low · heuristic · Code change*

This module reads a record and later writes it back without any transaction, `SELECT … FOR UPDATE`, or version column. Two concurrent writers can each read the old value and clobber each other — a classic lost update.

**Impact:** Silent data loss under concurrency: balances, counters, and inventory drift when two requests race.

**Evidence:**

- `tests/controls-runner.ts:159`
  ```
  db.run("UPDATE jobs SET status='done'");
  ```

**Fix:**

Wrap the read-modify-write in a transaction, or use an optimistic-lock version column and retry on conflict, or push the mutation into a single atomic SQL statement (`UPDATE … SET x = x + 1`).

**References:** <https://en.wikipedia.org/wiki/Write%E2%80%93write_conflict>

#### 🟡 Read-modify-write with no transaction / optimistic lock

*MEDIUM — production-ready:lost-update · confidence: low · heuristic · Code change*

This module reads a record and later writes it back without any transaction, `SELECT … FOR UPDATE`, or version column. Two concurrent writers can each read the old value and clobber each other — a classic lost update.

**Impact:** Silent data loss under concurrency: balances, counters, and inventory drift when two requests race.

**Evidence:**

- `src/lib/controls.ts:48`
  ```
  ON CONFLICT(scope,bucket) DO UPDATE SET used = used + 1 WHERE used < ?
  ```

**Fix:**

Wrap the read-modify-write in a transaction, or use an optimistic-lock version column and retry on conflict, or push the mutation into a single atomic SQL statement (`UPDATE … SET x = x + 1`).

**References:** <https://en.wikipedia.org/wiki/Write%E2%80%93write_conflict>

#### 🟡 Read-modify-write with no transaction / optimistic lock

*MEDIUM — production-ready:lost-update · confidence: low · heuristic · Code change*

This module reads a record and later writes it back without any transaction, `SELECT … FOR UPDATE`, or version column. Two concurrent writers can each read the old value and clobber each other — a classic lost update.

**Impact:** Silent data loss under concurrency: balances, counters, and inventory drift when two requests race.

**Evidence:**

- `src/lib/review.ts:52`
  ```
  const reserved = db.query("UPDATE jobs SET rewrites = rewrites + 1 WHERE id = ? AND status =
  ```

**Fix:**

Wrap the read-modify-write in a transaction, or use an optimistic-lock version column and retry on conflict, or push the mutation into a single atomic SQL statement (`UPDATE … SET x = x + 1`).

**References:** <https://en.wikipedia.org/wiki/Write%E2%80%93write_conflict>

**Manual review for this domain:**

- [ ] **🔒 (gates launch)** Double-submit every create/pay/delete action (click twice fast, and retry on a flaky network) — confirm exactly one side effect
  - *why:* Idempotency and in-flight guards can only be confirmed by exercising the real flow.
- [ ] **🔒 (gates launch)** Open the app in two tabs, edit the same record in both, save both — confirm the second save is rejected or merged, not silently lost
  - *why:* Lost-update / optimistic-lock behaviour is invisible to static analysis.
- [ ] Fire two requests that depend on ordering (e.g. create then immediately update) and confirm out-of-order arrival is handled
  - *why:* Request ordering / race conditions surface only under real latency.
- [ ] Trigger a provider webhook twice with the same event id — confirm the second is a no-op (dedupe by event id)
  - *why:* Webhook redelivery is guaranteed by most providers; duplicate processing corrupts state.
- [ ] Kill the process mid-write (or simulate it) and confirm no partially-written / torn state remains on restart
  - *why:* Atomic-write / crash-consistency guarantees need a fault-injection test.

---

### Visual Consistency

*Ran in 0.00s with: production-ready:visual-heuristics*

✅ No findings in this domain.
**Manual review for this domain:**

- [ ] **🔒 (gates launch)** Tab through every interactive element — confirm hover, focus-visible, active, and disabled states all exist and are distinct
  - *why:* AI-generated components routinely ship only the default state; missing focus rings also fail accessibility.
- [ ] Shrink to 320px and grow to 1440px+ — confirm no horizontal scroll, clipped text, or overlapping elements at any breakpoint
  - *why:* Overflow and breakpoint gaps are perceptual and not detectable by grep.
- [ ] **🔒 (gates launch)** Render the loading, empty, error, and success state of every data view — confirm all four are designed, not just the happy path
  - *why:* Empty/error/loading states are the most commonly missing screens in AI-built UIs.
- [ ] Compare headings, body, and captions across 3+ screens — confirm one consistent type scale, not per-screen font sizes
  - *why:* Typography drift is obvious to users but invisible to static checks.
- [ ] Fill fields with the longest realistic content (long names, long i18n strings, big numbers) — confirm nothing truncates or breaks layout
  - *why:* Localization/content expansion (German, etc.) breaks fixed-width layouts.
- [ ] Spot-check that repeated components (buttons, cards, inputs) use one shared variant, not divergent one-off copies
  - *why:* Component-variant drift accumulates silently across a codebase.

---

### seo-aeo

*Ran in 0.03s with: curl*

> Missing tools: `lighthouse`

#### 🔵 No JSON-LD structured data in any template

*LOW — filesystem/grep · confidence: medium · heuristic · Code change*

Static scan found no JSON-LD blocks. JSON-LD is not a ranking factor but helps answer engines interpret entities when it matches visible content. Confirm with a rendered fetch — some sites inject it at runtime.

**Fix:**

If the page represents a clear entity, add matching JSON-LD. Validate with the Rich Results Test.

#### 🔵 noindex directive in template: lib/ste100page.ts

*LOW — filesystem/grep · confidence: medium · heuristic · Code change*

A page template emits a noindex robots meta. This is correct for staging/private pages but a defect if leaked to production public routes. Confirm the template is not used for intended-public pages.

**Evidence:**

- `/opt/zouroboros/repo/Projects/reporeel-deploy/reporeel/src/lib/ste100page.ts:15`
  ```
  <meta name="robots" content="noindex" />
  ```

**Fix:**

If this template renders public content, remove the noindex. If it's a staging/private template, ensure production builds don't import it.

**Manual review for this domain:**

- [ ] Confirm structured data (if present) matches visible page content
  - *why:* Schema that does not mirror visible content is a spam signal and can trigger manual action. The Rich Results Test validates syntax; only a human can confirm semantic match against the rendered page.

---
