import { join } from "node:path";
import { runPipeline } from "./lib/pipeline";
import { normalizeOptions, FORMATS, GROUNDINGS } from "./lib/options";
import { log } from "./lib/log";

function usage(): never {
  process.stderr.write(
    `usage: bun src/cli.ts <github-url> [--format landscape|vertical|square] [--grounding readme|code|both] [--captions] [--out-dir <dir>]\n` +
      `  url: repo, pull request, release (or owner/repo@tag), or compare URL\n` +
      `  formats: ${Object.entries(FORMATS).map(([k, v]) => `${k} (${v.ratio})`).join(", ")}\n` +
      `  grounding: ${Object.keys(GROUNDINGS).join(", ")}\n`
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--"));
if (!url) usage();
function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
const opts = normalizeOptions({ format: flag("format"), grounding: flag("grounding"), captions: args.includes("--captions"), review: false });
const slug = url.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(-60);
const jobDir = flag("out-dir") ?? join(import.meta.dir, "..", "data", "jobs", `dev-${slug}-${opts.format}`);
const result = await runPipeline(url, jobDir, opts, (s) => log(`stage: ${s}`));
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
