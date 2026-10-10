import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("public launch controls: integration, concurrency and restart regressions", async () => {
  const dir = mkdtempSync(join(tmpdir(), "reporeel-controls-"));
  const proc = Bun.spawn([process.execPath, join(import.meta.dir, "controls-runner.ts")], {
    env: {
      ...process.env,
      REPOREEL_DATA_DIR: dir,
      REPOREEL_RATE_LIMIT: "3",
      REPOREEL_MAX_QUEUE: "3",
      REPOREEL_MAX_REWRITES: "2",
      REPOREEL_AI_DAILY: "100",
      REPOREEL_AI_CONCURRENCY: "2",
      REPOREEL_STE_DAILY: "2",
      OPENROUTER_API_KEY: "test-only-no-provider-access",
      GITHUB_TOKEN: "",
      GH_TOKEN: "",
      RENDER_DISABLED: "",
      REPOREEL_TRUSTED_PROXIES: "",
    }, stdout: "pipe", stderr: "pipe",
  });
  try {
    const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    expect({ code, out, err }).toMatchObject({ code: 0 });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 30_000);
