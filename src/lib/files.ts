import { join } from "node:path";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";

export function dirSize(dir: string): number {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(p);
    else if (entry.isFile()) total += statSync(p).size;
  }
  return total;
}

export function cleanupAfterRender(jobDir: string): number {
  const assets = join(jobDir, "assets");
  if (existsSync(assets)) {
    for (const f of readdirSync(assets)) {
      if (/\.(wav|mp3|ogg)$/i.test(f)) rmSync(join(assets, f), { force: true });
    }
  }
  rmSync(join(jobDir, "gsap.min.js"), { force: true });
  return dirSize(jobDir);
}

export function removeDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
