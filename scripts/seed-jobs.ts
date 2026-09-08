import { randomBytes } from "node:crypto";
import { db, hashToken } from "../src/lib/db";
import { parseTarget, canonical } from "../src/lib/github";
import { normalizeOptions, variantKey } from "../src/lib/options";

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
const opts = normalizeOptions({ format: flag("format"), grounding: flag("grounding"), captions: args.includes("--captions"), review: false });
const variant = variantKey(opts);
const urls = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--format" && args[i - 1] !== "--grounding");
if (urls.length === 0) {
  console.error("usage: bun scripts/seed-jobs.ts [--format landscape|vertical|square] [--grounding readme|code|both] [--captions] <url> [<url> ...]");
  process.exit(1);
}
for (const url of urls) {
  const target = parseTarget(url);
  if (!target) {
    console.error(`skip (unparseable): ${url}`);
    continue;
  }
  const canon = canonical(target);
  const existing = db
    .query("SELECT id,status FROM jobs WHERE canonical = ? AND variant = ? AND status IN ('queued','ingesting','scripting','review','voicing','rendering','done') LIMIT 1")
    .get(canon, variant) as { id: string; status: string } | null;
  if (existing) {
    console.log(`exists ${existing.status}: ${canon} [${variant}] -> ${existing.id}`);
    continue;
  }
  const id = randomBytes(6).toString("base64url");
  db.run(
    "INSERT INTO jobs (id,url,canonical,status,ip,created_at,options,variant,format,kind,owner_hash,pinned) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)",
    [id, url, canon, "queued", `seed-${id}`, Date.now(), JSON.stringify(opts), variant, opts.format, target.kind, hashToken(randomBytes(18).toString("base64url"))]
  );
  console.log(`queued: ${canon} [${variant}] -> ${id}`);
}
