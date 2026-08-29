import { Database } from "bun:sqlite";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { parseTarget, canonical } from "../src/lib/github";

const db = new Database(join(import.meta.dir, "..", "data", "reporeel.db"));
const urls = process.argv.slice(2);
for (const url of urls) {
  const target = parseTarget(url);
  if (!target) {
    console.error(`skip (unparseable): ${url}`);
    continue;
  }
  const canon = canonical(target);
  const existing = db
    .query("SELECT id,status FROM jobs WHERE canonical = ? AND status IN ('queued','running','done') LIMIT 1")
    .get(canon) as { id: string; status: string } | null;
  if (existing) {
    console.log(`exists ${existing.status}: ${canon} -> ${existing.id}`);
    continue;
  }
  const id = randomBytes(6).toString("base64url");
  db.run("INSERT INTO jobs (id,url,canonical,status,ip,created_at) VALUES (?,?,?,?,?,?)", [
    id, url, canon, "queued", `seed-${id}`, Date.now(),
  ]);
  console.log(`queued: ${canon} -> ${id}`);
}
