import { db, getJob, updateJob, jobDirFor, type Job } from "./db";
import { readFacts, readScript, writeScript } from "./pipeline";
import { regenerateScene, validateScript, type VideoScript } from "./script";
import { jobOptions, SubmitError } from "./queue";

import { assertGenerationEnabled, assertReviewIdle, withReviewLock, limit } from "./controls";

const MAX_REWRITES = limit("REPOREEL_MAX_REWRITES", 12);

export type ReviewState = { script: VideoScript; warnings: string[]; rewritesLeft: number };

function parseWarnings(job: Job): string[] {
  if (!job.warnings) return [];
  try {
    const w = JSON.parse(job.warnings);
    return Array.isArray(w) ? w.map(String) : [];
  } catch {
    return [];
  }
}

export function reviewState(job: Job): ReviewState {
  if (job.status !== "review") throw new SubmitError(409, "This reel is not waiting for review.");
  return { script: readScript(jobDirFor(job.id)), warnings: parseWarnings(job), rewritesLeft: Math.max(0, MAX_REWRITES - job.rewrites) };
}

export function saveScript(job: Job, raw: unknown): ReviewState {
  assertReviewIdle(job.id);
  job = getJob(job.id) ?? job;
  if (job.status !== "review") throw new SubmitError(409, "This reel is not waiting for review.");
  const current = readScript(jobDirFor(job.id));
  const next = validateScript(raw);
  if (next.scenes.length !== current.scenes.length) throw new SubmitError(400, "Scene count cannot change.");
  next.scenes.forEach((s, i) => {
    s.kind = current.scenes[i]!.kind;
  });
  const warnings = writeScript(jobDirFor(job.id), next, readFacts(jobDirFor(job.id)), jobOptions(job));
  updateJob(job.id, { title: next.title, warnings: JSON.stringify(warnings), stage_started_at: Date.now() });
  return { script: next, warnings, rewritesLeft: Math.max(0, MAX_REWRITES - job.rewrites) };
}

export async function rewriteScene(job: Job, index: number, hint: string): Promise<ReviewState> {
  assertGenerationEnabled();
  return withReviewLock(job.id, async () => {
    job = getJob(job.id) ?? job;
    if (job.status !== "review") throw new SubmitError(409, "This reel is not waiting for review.");
    if (job.rewrites >= MAX_REWRITES) throw new SubmitError(429, `Rewrite limit reached (${MAX_REWRITES} per reel).`);
    const dir = jobDirFor(job.id);
    const script = readScript(dir);
    if (!Number.isInteger(index) || index < 0 || index >= script.scenes.length) throw new SubmitError(400, "No such scene.");
    const facts = readFacts(dir);
    const reserved = db.query("UPDATE jobs SET rewrites = rewrites + 1 WHERE id = ? AND status = 'review' AND rewrites < ? RETURNING rewrites").get(job.id, MAX_REWRITES);
    if (!reserved) throw new SubmitError(429, "Rewrite limit reached.");

    const scene = await regenerateScene(facts, jobOptions(job), script, index, hint);
    assertGenerationEnabled();
    if (getJob(job.id)?.status !== "review") throw new SubmitError(409, "This reel is no longer waiting for review.");
    if (scene.kind === "outro") scene.lines = script.scenes[index]!.lines;
    script.scenes[index] = scene;
    const warnings = writeScript(dir, script, facts, jobOptions(job));
    updateJob(job.id, { warnings: JSON.stringify(warnings), stage_started_at: Date.now() });
    const fresh = getJob(job.id)!;
    return { script, warnings, rewritesLeft: Math.max(0, MAX_REWRITES - fresh.rewrites) };
  });
}
