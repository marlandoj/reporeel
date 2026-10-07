import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { produce } from "../src/lib/pipeline";
import { normalizeOptions } from "../src/lib/options";
import { checkHuashu } from "../src/lib/huashu";

// Curated, source-grounded script: no GitHub ingest or LLM call is needed.
checkHuashu();
const dir = resolve(process.argv[2] || "data/huashu-demo");
const format = process.argv[3] || "landscape";
if (!["landscape", "vertical", "square"].includes(format)) throw new Error("Unknown format");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "script.json"), readFileSync(join(import.meta.dir, "../docs/examples/hermes-script.json")));
console.log(await produce(dir, normalizeOptions({ renderer: "huashu-keynote", format, captions: true }), {
  onStage: console.log,
  onProgress: (done, total) => console.log(`Frames: ${done}/${total}`),
}));
