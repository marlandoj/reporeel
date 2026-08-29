import { join } from "node:path";
import { runPipeline } from "./lib/pipeline";
import { log } from "./lib/log";

const url = process.argv[2];
if (!url) {
  process.stderr.write("usage: bun src/cli.ts <github-repo-or-pr-url>\n");
  process.exit(1);
}
const slug = url.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(-60);
const jobDir = join(import.meta.dir, "..", "data", "jobs", `dev-${slug}`);
const result = await runPipeline(url, jobDir, (s) => log(`stage: ${s}`));
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
