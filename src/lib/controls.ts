import { existsSync } from "node:fs";
import { join } from "node:path";
import { isIP } from "node:net";
import { DATA_DIR, db } from "./db";

export class ControlError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function limit(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function generationPaused(): boolean {
  return Boolean(process.env.RENDER_DISABLED) || existsSync(join(DATA_DIR, "STOP_GENERATION"));
}

export function assertGenerationEnabled(): void {
  if (generationPaused()) throw new ControlError(503, "Generation is paused right now. Try again later.");
}

function normalizeIp(ip: string): string {
  const value = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  return isIP(value) ? value.toLowerCase() : "";
}

/** Forwarded identities are accepted only from explicitly trusted socket peers. */
export function visitorIp(peer: string | undefined, headers: Headers): string {
  const socketIp = normalizeIp(peer ?? "");
  if (!socketIp) return "unknown";
  const trusted = (process.env.REPOREEL_TRUSTED_PROXIES ?? "").split(",").map(x => normalizeIp(x.trim())).filter(Boolean);
  if (trusted.includes(socketIp)) {
    const realIp = normalizeIp(headers.get("x-real-ip") ?? "");
    if (realIp) return realIp;
  }
  return socketIp;
}

db.run("CREATE TABLE IF NOT EXISTS usage_limits (scope TEXT NOT NULL, bucket INTEGER NOT NULL, used INTEGER NOT NULL, PRIMARY KEY(scope,bucket))");
db.run("CREATE TABLE IF NOT EXISTS request_cooldowns (scope TEXT PRIMARY KEY, last_at INTEGER NOT NULL)");

export function reserveDaily(scope: string, maximum: number, now = Date.now()): boolean {
  if (!Number.isSafeInteger(maximum) || maximum <= 0) return false;
  const bucket = Math.floor(now / 86400_000);
  const result = db.query(`
    INSERT INTO usage_limits (scope,bucket,used) VALUES (?,?,1)
    ON CONFLICT(scope,bucket) DO UPDATE SET used = used + 1 WHERE used < ?
    RETURNING used
  `).get(scope, bucket, maximum);
  return Boolean(result);
}

export function reserveCooldown(scope: string, interval: number, now = Date.now()): boolean {
  return Boolean(db.query(`
    INSERT INTO request_cooldowns (scope,last_at) VALUES (?,?)
    ON CONFLICT(scope) DO UPDATE SET last_at = excluded.last_at WHERE last_at <= ?
    RETURNING last_at
  `).get(scope, now, now - interval));
}

export function reserveSte(ip: string): void {
  assertGenerationEnabled();
  if (!reserveCooldown("ste:" + ip, 12_000)) throw new ControlError(429, "Slow down. One rewrite every 12 seconds.");
  if (!reserveDaily("ste", limit("REPOREEL_STE_DAILY", 80))) throw new ControlError(429, "Rewrite budget for today is used up. Check mode still works.");
}

const rewriting = new Set<string>();
export function assertReviewIdle(id: string): void {
  if (rewriting.has(id)) throw new ControlError(409, "A scene rewrite is already in progress for this reel.");
}
export async function withReviewLock<T>(id: string, action: () => Promise<T>): Promise<T> {
  assertReviewIdle(id);
  rewriting.add(id);
  try { return await action(); } finally { rewriting.delete(id); }
}

let activeAi = 0;
/** Every retry reserves its own durable allowance; failed calls are not refunded. */
export async function openRouterJson(body: Record<string, unknown>): Promise<any> {
  assertGenerationEnabled();
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new ControlError(503, "AI generation is not configured on this server.");
  if (activeAi >= limit("REPOREEL_AI_CONCURRENCY", 2)) throw new ControlError(429, "AI generation is busy. Try again soon.");
  if (!reserveDaily("ai", limit("REPOREEL_AI_DAILY", 0))) throw new ControlError(429, "AI request allowance for today is used up.");
  activeAi++;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 90_000);
  const stop = setInterval(() => { if (generationPaused()) abort.abort(); }, 250);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
    assertGenerationEnabled();
    if (!res.ok) throw new Error("OpenRouter returned " + res.status);
    const data = await res.json();
    assertGenerationEnabled();
    return data;
  } catch (e) {
    assertGenerationEnabled();
    throw e;
  } finally { activeAi--; clearTimeout(timer); clearInterval(stop); }
}

/** Stop the directly spawned child when the operator creates STOP_GENERATION. */
export function watchGenerationProcess(proc: { kill: () => void }): () => void {
  const timer = setInterval(() => {
    if (generationPaused()) { try { proc.kill(); } catch {} }
  }, 250);
  return () => clearInterval(timer);
}
