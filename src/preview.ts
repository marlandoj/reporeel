/** Read-only site preview: no database, worker, provider, or render initialization. */
import { Hono } from "hono";
import { join } from "node:path";
import { site } from "./lib/site";
import { stePageHtml } from "./lib/ste100page";

const app = new Hono();
app.route("/", site);
app.get(
  "/og.png",
  () => new Response(Bun.file(join(import.meta.dir, "../public/og.png"))),
);
app.get("/ste100", (c) => c.html(stePageHtml()));
app.get("/api/examples", (c) => c.json([]));
app.all("/api/*", (c) =>
  c.json(
    {
      error:
        "This is a site preview. Run the full RepoReel server to create movies or use writing tools.",
    },
    503,
  ),
);

export default {
  hostname: "127.0.0.1",
  port: Number(process.env.PORT ?? 3902),
  fetch: app.fetch,
};
