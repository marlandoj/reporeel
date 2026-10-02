import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkSamples, steQuickReference } from "../src/lib/steapi";

const OUT = join(import.meta.dir, "..", "public", "ste100");
mkdirSync(OUT, { recursive: true });

const ref = steQuickReference();
const sample = checkSamples();
const footer =
  "RepoReel is a machine-assisted aid. It is not affiliated with or endorsed by ASD or STEMG. " +
  "ASD-STE100 is a registered trademark of ASD. Full compliance requires the official dictionary, free at asd-ste100.org.";

writeFileSync(join(OUT, "asd-ste100-quick-reference.md"), `${ref.markdown}\n\n---\n\n_${footer}_\n`);

const style = `body{font:11pt/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#14181f;margin:0;padding:34px 38px}
h1{font-size:20pt;margin:0 0 4px;letter-spacing:-.01em}
h2{font-size:11pt;text-transform:uppercase;letter-spacing:.16em;color:#5b6878;margin:24px 0 8px;border-bottom:1px solid #d9dee6;padding-bottom:5px}
p.lead{color:#3a4454;margin:0 0 12px;font-size:10.5pt}
table{width:100%;border-collapse:collapse;margin:0 0 8px}
th{text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:.12em;color:#5b6878;border-bottom:1.5px solid #14181f;padding:5px 8px 5px 0}
td{padding:5px 8px 5px 0;border-bottom:1px solid #e6eaf0;vertical-align:top;font-size:10pt}
td.r,th.r{width:52px;font-weight:700;white-space:nowrap}
td.c,th.c{width:40px;text-align:right;white-space:nowrap}
td.m,th.m{width:78px;color:#5b6878;font-size:9pt}
.tag{display:inline-block;border:1px solid #c3ccd8;border-radius:999px;padding:1px 8px;font-size:8.5pt;color:#3a4454}
.tag.mch{border-color:#2f6f4f;color:#2f6f4f}
.sample{border-left:3px solid #14181f;background:#f6f8fb;padding:10px 14px;margin:0 0 10px}
.sample p{margin:0;font-size:10.5pt;line-height:1.55}
.cols{column-count:2;column-gap:26px}
table.tight td,table.tight th{padding:3.5px 8px 3.5px 0;font-size:9.5pt}
.foot{margin-top:26px;border-top:1px solid #d9dee6;padding-top:9px;color:#5b6878;font-size:8.5pt;line-height:1.5}
code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:9.5pt;background:#eef1f6;padding:1px 4px;border-radius:3px}
@page{size:A4;margin:14mm 12mm}`;

const html = `<!doctype html><html><head><meta charset="utf-8" />
<title>ASD-STE100 Quick Reference</title><style>${style}</style></head><body>
${ref.html}
<h2>Linter smoke test</h2>
${sample.html}
<div class="foot">${footer}</div>
</body></html>`;

writeFileSync(join(OUT, "asd-ste100-quick-reference.html"), html);
console.log("wrote", join(OUT, "asd-ste100-quick-reference.md"));
console.log("wrote", join(OUT, "asd-ste100-quick-reference.html"));
console.log("smoke:", sample.flagged, "of", sample.total, "sentences flagged");
