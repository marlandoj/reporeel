import assert from "node:assert/strict";
import { join } from "node:path";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { Database } from "bun:sqlite";
import { app } from "../src/server";
import {
  visitorIp, limit, reserveDaily, reserveCooldown, reserveSte, openRouterJson,
  ControlError, watchGenerationProcess,
} from "../src/lib/controls";
import { db, DATA_DIR, jobDirFor, getJob, updateJob } from "../src/lib/db";
import { submitJob, approveJob, workOne } from "../src/lib/queue";
import { rewriteScene, saveScript } from "../src/lib/review";
import { generateScript } from "../src/lib/script";
import { rewritePlain } from "../src/lib/steapi";
import { parseTarget, fetchStoryFacts } from "../src/lib/github";
import { normalizeOptions } from "../src/lib/options";

if (process.argv.includes("--restart")) {
  assert.equal(reserveDaily("restart", 1), false);
  assert.equal(reserveCooldown("restart-ip", 3600_000), false);
  console.log("restart controls passed");
  process.exit(0);
}

const headers = new Headers({ "x-forwarded-for": "203.0.113.9", "x-real-ip": "203.0.113.9" });
assert.equal(visitorIp("198.51.100.2", headers), "198.51.100.2");
assert.equal(visitorIp(undefined, headers), "unknown");
process.env.REPOREEL_TRUSTED_PROXIES = "127.0.0.1";
assert.equal(visitorIp("127.0.0.1", headers), "203.0.113.9");
assert.equal(visitorIp("::ffff:127.0.0.1", headers), "203.0.113.9");
assert.equal(visitorIp("127.0.0.1", new Headers({ "x-real-ip": "a,b" })), "127.0.0.1");
process.env.REPOREEL_TRUSTED_PROXIES = "";
for (const value of ["NaN", "-1", "Infinity", "1.5"]) {
  process.env.REPOREEL_TEST_LIMIT = value;
  assert.equal(limit("REPOREEL_TEST_LIMIT", 3), 0);
}
const day = 86400_000 * 100;
assert.equal(reserveDaily("rollover", 1, day), true);
assert.equal(reserveDaily("rollover", 1, day + 1), false);
assert.equal(reserveDaily("rollover", 1, day + 86400_000), true);
assert.equal(reserveDaily("zero", 0), false);
assert.equal(reserveDaily("restart", 1), true);
assert.equal(reserveCooldown("restart-ip", 3600_000), true);
const restart = Bun.spawn([process.execPath, import.meta.path, "--restart"], { env: { ...process.env }, stdout: "pipe", stderr: "pipe" });
const [restartOut, restartErr, restartCode] = await Promise.all([new Response(restart.stdout).text(), new Response(restart.stderr).text(), restart.exited]);
assert.equal(restartCode, 0, restartOut + restartErr);

reserveSte("ste-one");
assert.throws(() => reserveSte("ste-one"), e => e instanceof ControlError && e.status === 429);
const steUsed = (db.query("SELECT used FROM usage_limits WHERE scope='ste'").get() as { used: number }).used;
assert.equal(steUsed, 1, "cooldown rejection must not drain the daily allowance");
reserveSte("ste-two");
assert.throws(() => reserveSte("ste-three"), e => e instanceof ControlError && e.status === 429);

const script = { title: "Test", tagline: "A real test", scenes: Array.from({ length: 4 }, (_, i) => ({
  kind: i === 0 ? "title" : i === 3 ? "outro" : "text",
  heading: "Heading", lines: ["One fact"], narration: "The project reads a file and makes a video.",
})) };
const facts: any = {
  kind: "repo", grounding: "readme", owner: "owner", repo: "repo", url: "https://github.com/owner/repo",
  description: "A test", stars: 1, forks: 0, openIssues: 0, language: "TypeScript", languages: { TypeScript: 1 },
  license: "MIT", createdAt: "2020-01-01", pushedAt: "2026-01-01", topics: [], homepage: "",
  readmeExcerpt: "The project reads a file and makes a video.", recentCommits: [], contributors: [],
  releases: { count: 0, latestTag: "", latestAt: "" },
};
function seed(name: string) {
  const result = submitJob("https://github.com/owner/" + name, "ip-" + name, { grounding: "readme" }, true);
  updateJob(result.id, { status: "review" });
  const dir = jobDirFor(result.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "script.json"), JSON.stringify(script));
  writeFileSync(join(dir, "facts.json"), JSON.stringify(facts));
  return result;
}
const reel = seed("review");
let calls = 0;
const models: string[] = [];
let pending: ((value: Response) => void) | undefined;
let hold = false;
let malformed = false;
let privateRepo = false;
globalThis.fetch = (async (input: any, init?: RequestInit) => {
  const url = String(input);
  if (url.startsWith("https://api.github.com")) return Response.json({ private: privateRepo, pushed_at: "2026-01-01" });
  assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
  calls++;
  const body = JSON.parse(String(init?.body));
  models.push(body.model);
  if (hold) return new Promise<Response>((resolve, reject) => {
    pending = resolve;
    init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
  if (malformed) return Response.json({ choices: [{ message: { content: "bad JSON" } }] });
  const content = body.max_tokens === 4000 ? "Rewritten text." : body.max_tokens === 800 ? JSON.stringify(script.scenes[1]) : JSON.stringify(script);
  return Response.json({ choices: [{ message: { content } }] });
}) as typeof fetch;

async function request(path: string, method = "POST", body: any = {}, owner = "", peer = "198.51.100.10", extra: Record<string, string> = {}) {
  return app.fetch(new Request("http://localhost" + path, {
    method, headers: { "Content-Type": "application/json", ...(owner ? { "x-owner-token": owner } : {}), ...extra },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  }), { peerIp: peer });
}
assert.equal((await request("/api/ste100/scripts/" + reel.id, "GET")).status, 404);
assert.equal((await request("/api/ste100/scripts/" + reel.id, "GET", {}, reel.ownerToken!)).status, 200);
updateJob(reel.id, { status: "done" });
assert.equal((await request("/api/ste100/scripts/" + reel.id, "GET")).status, 200);
updateJob(reel.id, { status: "review" });

for (const useFile of [false, true]) {
  if (useFile) writeFileSync(join(DATA_DIR, "STOP_GENERATION"), "");
  else process.env.RENDER_DISABLED = "1";
  const paths: [string, any, string][] = [
    ["/api/jobs", { url: "https://github.com/owner/paused" }, ""],
    ["/api/jobs/" + reel.id + "/refresh", { force: true }, ""],
    ["/api/jobs/" + reel.id + "/render", {}, reel.ownerToken!],
    ["/api/jobs/" + reel.id + "/scenes/1/regenerate", {}, reel.ownerToken!],
    ["/api/ste100/rewrite", { text: "Text to rewrite." }, ""],
  ];
  for (const [path, body, token] of paths) assert.equal((await request(path, "POST", body, token)).status, 503, path);
  assert.equal(await workOne(), false, "paused worker must not dequeue recovered jobs");
  await assert.rejects(() => openRouterJson({}), e => e instanceof ControlError && e.status === 503);
  assert.equal((await request("/api/ste100/lint", "POST", { text: "The tool reads a file." })).status, 200);
  assert.equal((await request("/healthz", "GET")).status, 200);
  assert.equal(calls, 0);
  if (useFile) unlinkSync(join(DATA_DIR, "STOP_GENERATION"));
  else process.env.RENDER_DISABLED = "";
}

// Rate limiting uses the socket peer, even if every request forges another XFF.
db.run("UPDATE jobs SET status='done'");
for (let i = 0; i < 3; i++) {
  const result = await request("/api/jobs", "POST", { url: "https://github.com/owner/rate" + i }, "", "198.51.100.10", { "x-forwarded-for": "203.0.113." + i });
  assert.equal(result.status, 200);
}
assert.equal((await request("/api/jobs", "POST", { url: "https://github.com/owner/rate4" }, "", "198.51.100.10", { "x-forwarded-for": "203.0.113.99" })).status, 429);
updateJob(reel.id, { status: "review" });
assert.throws(() => approveJob(getJob(reel.id)!), e => (e as any).status === 429);
db.run("UPDATE jobs SET status='review' WHERE status='queued'");
assert.equal((await request("/api/jobs", "POST", { url: "https://github.com/owner/full" }, "", "198.51.100.11")).status, 429, "review jobs must count toward admission bounds");
const attached = submitJob("https://github.com/owner/review", "another-ip", { grounding: "readme" });
assert.equal(attached.attached, true);
db.run("UPDATE jobs SET status='done'");
updateJob(reel.id, { status: "review", rewrites: 1 });
const stale = getJob(reel.id)!;
hold = true;
const first = rewriteScene(stale, 1, "");
await assert.rejects(() => rewriteScene(stale, 1, ""), e => (e as any).status === 409);
assert.throws(() => saveScript(stale, script), e => (e as any).status === 409);
assert.throws(() => approveJob(stale), e => (e as any).status === 409);
assert.equal(calls, 1);
pending!(Response.json({ choices: [{ message: { content: JSON.stringify(script.scenes[1]) } }] }));
await first;
hold = false;
assert.equal(getJob(reel.id)!.rewrites, 2);
await assert.rejects(() => rewriteScene(stale, 1, ""), e => (e as any).status === 429);
assert.equal(calls, 1, "stale snapshots must not buy additional calls");

// Every fallback attempt shares the same durable provider allowance.
db.run("DELETE FROM usage_limits WHERE scope='ai'");
process.env.REPOREEL_AI_DAILY = "1";
malformed = true;
const before = calls;
await assert.rejects(() => generateScript(facts, normalizeOptions({})), e => (e as any).status === 429);
assert.equal(calls - before, 1);
malformed = false;
delete process.env.REPOREEL_AI_DAILY;
await assert.rejects(() => openRouterJson({}), e => (e as any).status === 429);
assert.equal(calls - before, 1, "unset allowance fails closed");

// A provider fetch already in flight is aborted by the live stop file.
db.run("DELETE FROM usage_limits WHERE scope='ai'");
process.env.REPOREEL_AI_DAILY = "100";
process.env.REPOREEL_AI_CONCURRENCY = "1";
hold = true;
const inFlight = openRouterJson({});
await assert.rejects(() => openRouterJson({}), e => (e as any).status === 429);
writeFileSync(join(DATA_DIR, "STOP_GENERATION"), "");
await assert.rejects(() => inFlight, e => (e as any).status === 503);
unlinkSync(join(DATA_DIR, "STOP_GENERATION"));
hold = false;
let killed = false;
const unwatch = watchGenerationProcess({ kill() { killed = true; } });
writeFileSync(join(DATA_DIR, "STOP_GENERATION"), "");
await Bun.sleep(350);
unwatch();
assert.equal(killed, true);
unlinkSync(join(DATA_DIR, "STOP_GENERATION"));

// Failed STE models must actually advance through the fallback model list.
const original = globalThis.fetch;
let failures = 0;
globalThis.fetch = (async (url: any, init?: RequestInit) => {
  if (failures++ < 2) {
    models.push(JSON.parse(String(init?.body)).model);
    return new Response("", { status: 503 });
  }
  return original(url, init);
}) as typeof fetch;
const from = models.length;
await rewritePlain("Some text.");
assert.deepEqual(models.slice(from), ["anthropic/claude-sonnet-4.5", "google/gemini-2.5-flash", "openai/gpt-4o-mini"]);
globalThis.fetch = original;

assert.equal(parseTarget("https://github.com/../repo"), null);
assert.equal(parseTarget("owner/.."), null);
assert.equal(parseTarget("https://github.com/owner/repo")?.kind, "repo");
privateRepo = true;
await assert.rejects(() => fetchStoryFacts({ kind: "repo", owner: "owner", repo: "private" }), /only works with public|not found or not public/);

const secondConnection = new Database(join(DATA_DIR, "reporeel.db"));
assert.equal((secondConnection.query("SELECT used FROM usage_limits WHERE scope='ste'").get() as { used: number }).used, 2);
secondConnection.close();
console.log("public launch controls passed");
