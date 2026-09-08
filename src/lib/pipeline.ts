import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseTarget, canonical, fetchStoryFacts, type StoryFacts, type Target } from "./github";
import { generateScript, groundingWarnings, validateScript, type VideoScript } from "./script";
import { synthesizeScenes } from "./tts";
import { buildComposition } from "./compose";
import { renderComposition, makePoster, type RenderHooks } from "./render";
import { cleanupAfterRender } from "./files";
import type { JobOptions } from "./options";
import { log } from "./log";

export type Stage = "ingesting" | "scripting" | "voicing" | "rendering";

export class CancelledError extends Error {
  constructor() {
    super("cancelled");
  }
}

export type PrepareHooks = {
  onStage?: (stage: Stage) => void;
  checkCancel?: () => void;
};

export type ProduceHooks = PrepareHooks & RenderHooks;

export type PrepareResult = {
  target: Target;
  facts: StoryFacts;
  script: VideoScript;
  warnings: string[];
  title: string;
  canonical: string;
  sourcePushedAt: string;
  sourceTag: string;
};

export type ProduceResult = {
  mp4: string;
  total: number;
  title: string;
  sizeBytes: number;
  captions: number;
};

export function readScript(jobDir: string): VideoScript {
  return validateScript(JSON.parse(readFileSync(join(jobDir, "script.json"), "utf8")));
}

export function readFacts(jobDir: string): StoryFacts {
  return JSON.parse(readFileSync(join(jobDir, "facts.json"), "utf8")) as StoryFacts;
}

export function writeScript(jobDir: string, script: VideoScript, facts: StoryFacts): string[] {
  const warnings = groundingWarnings(script, facts);
  writeFileSync(join(jobDir, "script.json"), JSON.stringify(script, null, 2));
  writeFileSync(join(jobDir, "warnings.json"), JSON.stringify(warnings, null, 2));
  return warnings;
}

export async function prepare(url: string, jobDir: string, opts: JobOptions, hooks: PrepareHooks = {}): Promise<PrepareResult> {
  const target = parseTarget(url);
  if (!target) throw new Error("Not a valid public GitHub repo, PR, release, or compare URL.");
  mkdirSync(join(jobDir, "assets"), { recursive: true });

  hooks.onStage?.("ingesting");
  hooks.checkCancel?.();
  log(`ingest ${canonical(target)} (${opts.grounding}, ${opts.format})`);
  const facts = await fetchStoryFacts(target, opts.grounding);
  writeFileSync(join(jobDir, "facts.json"), JSON.stringify(facts, null, 2));

  hooks.onStage?.("scripting");
  hooks.checkCancel?.();
  const script = await generateScript(facts, opts);
  const outro = script.scenes[script.scenes.length - 1];
  if (outro && outro.kind === "outro") outro.lines = [facts.url.replace(/^https?:\/\//, "")];
  const warnings = writeScript(jobDir, script, facts);
  if (warnings.length) log(`grounding warnings (${warnings.length}): ${warnings.join(" | ")}`);

  return {
    target,
    facts,
    script,
    warnings,
    title: script.title,
    canonical: canonical(target),
    sourcePushedAt: facts.pushedAt,
    sourceTag: facts.release?.tag ?? "",
  };
}

export async function produce(jobDir: string, opts: JobOptions, hooks: ProduceHooks = {}): Promise<ProduceResult> {
  const script = readScript(jobDir);
  mkdirSync(join(jobDir, "assets"), { recursive: true });

  hooks.onStage?.("voicing");
  hooks.checkCancel?.();
  const audio = await synthesizeScenes(script.scenes.map((s) => s.narration), join(jobDir, "assets"));
  hooks.checkCancel?.();
  const { total, captions } = buildComposition(script, audio, jobDir, opts);
  log(`composition built: ${total}s, ${opts.format}, ${captions.length} captions`);

  hooks.onStage?.("rendering");
  hooks.checkCancel?.();
  const mp4 = await renderComposition(jobDir, { onProgress: hooks.onProgress, register: hooks.register });
  await makePoster(jobDir);
  const sizeBytes = cleanupAfterRender(jobDir);
  return { mp4, total, title: script.title, sizeBytes, captions: captions.length };
}

export async function runPipeline(
  url: string,
  jobDir: string,
  opts: JobOptions,
  onStage?: (stage: Stage) => void
): Promise<ProduceResult & { canonical: string; warnings: string[] }> {
  const prep = await prepare(url, jobDir, opts, { onStage });
  const out = await produce(jobDir, opts, { onStage });
  return { ...out, canonical: prep.canonical, warnings: prep.warnings };
}
