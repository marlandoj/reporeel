import { describe, expect, test } from "bun:test";
import { site } from "../src/lib/site";

// Request the real route module without importing the production queue or starting workers.
describe("site navigation and sample delivery", () => {
  test("landing page leads into studio; studio still exposes rendering controls", async () => {
    const home = await site.request("/");
    expect(home.status).toBe(200);
    const html = await home.text();
    expect(html).toContain('action="/studio"');
    expect(html).toContain('name="repo"');
    expect(html).toContain("/site/hermes-keynote.mp4");
    const studio = await site.request(
      "/studio?repo=https%3A%2F%2Fgithub.com%2Fa%2Fb",
    );
    expect(studio.status).toBe(200);
    expect(await studio.text()).toContain('id="renderer"');
  });
  test("showcase supports initial and suffix ranges for seeking", async () => {
    const full = await site.request("/site/hermes-keynote.mp4");
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("video/mp4");
    const bytes = new Uint8Array(await full.arrayBuffer());
    for (const [range, start, end] of [
      ["bytes=0-31", 0, 31],
      ["bytes=-16", bytes.length - 16, bytes.length - 1],
      [`bytes=${bytes.length - 8}-`, bytes.length - 8, bytes.length - 1],
    ] as const) {
      const partial = await site.request("/site/hermes-keynote.mp4", {
        headers: { range },
      });
      expect(partial.status).toBe(206);
      expect(partial.headers.get("content-range")).toBe(
        `bytes ${start}-${end}/${bytes.length}`,
      );
      expect(new Uint8Array(await partial.arrayBuffer())).toEqual(
        bytes.slice(start, end + 1),
      );
    }
  });
  test("invalid or unsatisfiable ranges are rejected", async () => {
    for (const range of [
      "bytes=",
      "bytes=8-3",
      "bytes=-0",
      "bytes=999999999999999999999-",
      "bytes=0-1,3-4",
      "nonsense",
    ]) {
      expect(
        (await site.request("/site/hermes-keynote.mp4", { headers: { range } }))
          .status,
      ).toBe(416);
    }
  });
  test("only explicit showcase assets are exposed, with valid captions", async () => {
    for (const path of [
      "/site/site.css",
      "/site/studio.css",
      "/site/hermes-keynote.jpg",
      "/site/hermes-keynote.vtt",
    ]) {
      const response = await site.request(path);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    }
    expect(
      await (await site.request("/site/hermes-keynote.vtt")).text(),
    ).toStartWith("WEBVTT\n");
    expect((await site.request("/site/package.json")).status).toBe(404);
    expect((await site.request("/site/.env")).status).toBe(404);
  });
});
