import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { parseTarget, canonical, fetchStoryFacts } from "./github";
import { generateScript } from "./script";
import { synthesizeScenes } from "./tts";
import { buildComposition } from "./compose";
import { renderComposition } from "./render";
import { log } from "./log";

export type Stage = "ingesting" | "scripting" | "voicing" | "rendering" | "done";

export async function runPipeline(
  url: string,
  jobDir: string,
  onStage?: (stage: Stage) => void
): Promise<{ mp4: string; total: number; title: string; canonical: string }> {
  const target = parseTarget(url);
  if (!target) throw new Error("Not a valid public GitHub repo or PR URL.");
  mkdirSync(join(jobDir, "assets"), { recursive: true });

  onStage?.("ingesting");
  log(`ingest ${canonical(target)}`);
  const facts = await fetchStoryFacts(target);
  writeFileSync(join(jobDir, "facts.json"), JSON.stringify(facts, null, 2));

  onStage?.("scripting");
  const script = await generateScript(facts);
  const outro = script.scenes[script.scenes.length - 1];
  if (outro && outro.kind === "outro") {
    outro.lines = [facts.url.replace(/^https?:\/\//, "")];
  }
  writeFileSync(join(jobDir, "script.json"), JSON.stringify(script, null, 2));

  onStage?.("voicing");
  const audio = await synthesizeScenes(
    script.scenes.map((s) => s.narration),
    join(jobDir, "assets")
  );

  const { total } = buildComposition(script, audio, jobDir);
  log(`composition built: ${total}s`);

  onStage?.("rendering");
  const mp4 = await renderComposition(jobDir);

  onStage?.("done");
  return { mp4, total, title: script.title, canonical: canonical(target) };
}
