import type { StoryFacts } from "./github";
import { FORMATS, type JobOptions } from "./options";
import { log } from "./log";

export type SceneKind = "title" | "stats" | "text" | "list" | "code" | "outro";

export type Scene = {
  kind: SceneKind;
  heading: string;
  lines?: string[];
  stats?: { value: string; label: string }[];
  narration: string;
};

export type VideoScript = {
  title: string;
  tagline: string;
  scenes: Scene[];
};

const KINDS: SceneKind[] = ["title", "stats", "text", "list", "code", "outro"];

const MODELS = [
  "anthropic/claude-sonnet-4.5",
  "google/gemini-2.5-flash",
  "openai/gpt-4o-mini",
];

function systemPrompt(opts: JobOptions): string {
  const f = FORMATS[opts.format];
  return `You write scripts for short narrated explainer videos about GitHub repositories.
Return ONLY a JSON object, no markdown fences, matching:
{
  "title": "repo display name",
  "tagline": "one line under 60 chars",
  "scenes": [
    {
      "kind": "title" | "stats" | "text" | "list" | "code" | "outro",
      "heading": "on-screen heading, under ${f.headingMax} chars",
      "lines": ["up to 3 short on-screen lines, each under ${f.lineMax} chars"],
      "stats": [{"value": "12.4k", "label": "stars"}],
      "narration": "what the narrator says during this scene, 15-30 words, plain spoken English"
    }
  ]
}
Rules:
- Exactly 6 scenes. Scene 1 kind "title". Last scene kind "outro".
- Include exactly one "stats" scene with 3-4 stats drawn from the real numbers given.
- Use "list" for features or use cases, "code" for tech stack or key files, "text" for the core idea.
- Total narration across all scenes: 90 to 115 words. Each scene narration 12 to 22 words. Never invent facts not in the data.
- Never claim awards, rankings, placements, adoption, or outcomes unless the data states them explicitly.
- Narration must flow as one continuous voiceover when read scene after scene.
- Every on-screen line, heading, and tagline must be a complete self-contained phrase. Never split a sentence across lines or scenes, never end a line mid-thought.
- Title scene: lines[0] is the project display name, lines[1] is a complete tagline phrase.
- The outro narration ends with a short memorable closing line about the project.
- No emojis anywhere. Values like "12.4k" for numbers over 999.
- The video is ${f.ratio} (${f.label.toLowerCase()}); keep on-screen text within the character limits above.`;
}

function groundingInstructions(facts: StoryFacts): string {
  const g = facts.grounding;
  if (g === "code") {
    return `GROUNDING: code only. The README was deliberately NOT provided. Describe what the project does from its file tree, manifest, dependencies, and entry file. The "code" scene must show real file paths or dependency names, or quote up to 3 lines VERBATIM from ENTRY_FILE (copy them exactly, no paraphrase). Never describe features you cannot see in the code facts.`;
  }
  if (g === "readme") {
    return `GROUNDING: README and metadata only. The "code" scene shows the tech stack from the languages list and README.`;
  }
  return `GROUNDING: README plus code. Use the README for what the project is and why it exists; use the code facts (tree, manifest, dependencies, entry file) for how it is built. The "code" scene should show real file paths, real dependency names, or lines quoted VERBATIM from ENTRY_FILE.`;
}

function focusInstructions(facts: StoryFacts): string {
  if (facts.pr) return "Focus the story on the pull request: what it changes, why it matters, its scale. Use repo context as backdrop.";
  if (facts.release) {
    const r = facts.release;
    return `Focus the story on release ${r.tag} of ${facts.repo}: a "what's new" changelog reel. Title scene: lines[0] is "${facts.repo} ${r.tag}", lines[1] is a phrase about the release. Use a "list" scene for the top 3 highlights taken from the release notes or commit messages. The "stats" scene uses release-scale numbers (commits since ${r.prevTag || "the previous release"}, files changed, additions, deletions, or repo stars). A "text" scene says why this release matters. The "code" scene names the most changed files. Never invent changes that are not in the release notes or commits.`;
  }
  if (facts.compare) {
    const c = facts.compare;
    return `Focus the story on the changes between ${c.baseRef} and ${c.headRef} in ${facts.repo}: a "what changed" reel. Title scene: lines[0] is "${facts.repo}", lines[1] mentions ${c.baseRef} to ${c.headRef}. Use a "list" scene for the top 3 themes from the commit messages, a "stats" scene with commits, files changed, additions, deletions, a "text" scene on why it matters, and a "code" scene naming the most changed files. Never invent changes that are not in the commits.`;
  }
  return "Tell the story of this repository: what it is, why it exists, what stands out.";
}

function slimFacts(facts: StoryFacts): Record<string, unknown> {
  const { code, ...rest } = facts;
  const slim: Record<string, unknown> = { ...rest, readmeExcerpt: facts.readmeExcerpt.slice(0, 5000) };
  if (code) {
    slim.code = {
      defaultBranch: code.defaultBranch,
      fileCount: code.fileCount,
      topLevel: code.topLevel,
      keyDirs: code.keyDirs,
      manifest: code.manifest,
      ENTRY_FILE: code.entry ? { path: code.entry.path, lines: code.entry.lines } : null,
    };
  }
  return slim;
}

function userPrompt(facts: StoryFacts): string {
  return `${focusInstructions(facts)}\n${groundingInstructions(facts)}\n\nDATA:\n${JSON.stringify(slimFacts(facts))}`;
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

function extractJson(s: string): any {
  const cleaned = stripFences(s);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("no JSON object in completion");
  }
}

function cleanScene(s: any): Scene {
  if (!s || typeof s !== "object") throw new Error("scene not an object");
  const heading = String(s.heading ?? "").trim().slice(0, 80);
  const narration = String(s.narration ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
  if (!heading || !narration) throw new Error("scene missing heading or narration");
  const kind: SceneKind = KINDS.includes(s.kind) ? s.kind : "text";
  const out: Scene = { kind, heading, narration };
  if (kind !== "stats" && Array.isArray(s.lines)) {
    out.lines = s.lines.map((l: unknown) => String(l ?? "").trim().slice(0, 110)).filter(Boolean).slice(0, 4);
  }
  if (kind === "stats" && Array.isArray(s.stats)) {
    out.stats = s.stats
      .filter((st: any) => st && typeof st === "object")
      .map((st: any) => ({ value: String(st.value ?? "").trim().slice(0, 16), label: String(st.label ?? "").trim().slice(0, 28) }))
      .filter((st: { value: string; label: string }) => st.value && st.label)
      .slice(0, 4);
  }
  return out;
}

export function validateScript(obj: any): VideoScript {
  if (!obj || typeof obj !== "object") throw new Error("script not an object");
  if (!Array.isArray(obj.scenes) || obj.scenes.length < 4 || obj.scenes.length > 8) throw new Error("bad scene count");
  const scenes = obj.scenes.map(cleanScene);
  const totalWords = scenes.reduce((a: number, s: Scene) => a + s.narration.split(/\s+/).length, 0);
  if (totalWords > 260) throw new Error("narration too long");
  return {
    title: String(obj.title ?? "Untitled").trim().slice(0, 80) || "Untitled",
    tagline: String(obj.tagline ?? "").trim().slice(0, 120),
    scenes,
  };
}

async function chat(model: string, system: string, user: string, maxTokens = 2000): Promise<any> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.6,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status} for ${model}`);
  const data: any = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`empty completion from ${model}`);
  return extractJson(content);
}

async function withFallback<T>(label: string, fn: (model: string) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await fn(model);
      } catch (e) {
        lastErr = e;
        log(`${label} failed (${model}, attempt ${attempt + 1}): ${e}`);
      }
    }
  }
  throw new Error(`${label} failed on all models: ${lastErr}`);
}

export async function generateScript(facts: StoryFacts, opts: JobOptions): Promise<VideoScript> {
  return withFallback("script generation", async (model) => validateScript(await chat(model, systemPrompt(opts), userPrompt(facts))));
}

export async function regenerateScene(
  facts: StoryFacts,
  opts: JobOptions,
  script: VideoScript,
  index: number,
  hint = ""
): Promise<Scene> {
  const current = script.scenes[index];
  if (!current) throw new Error("no such scene");
  const f = FORMATS[opts.format];
  const system = `You rewrite ONE scene of a narrated explainer video script about a GitHub repository.
Return ONLY a JSON object for the single rewritten scene, no markdown fences:
{"kind": "${current.kind}", "heading": "under ${f.headingMax} chars", "lines": ["up to 3 lines, each under ${f.lineMax} chars"], "stats": [{"value": "..", "label": ".."}], "narration": "12-22 words, plain spoken English"}
Rules: keep the same kind ("${current.kind}"). Keep the narration flowing naturally from the previous scene into the next one. Never invent facts not in the data. Never claim awards, rankings, placements, or outcomes unless the data states them explicitly. No emojis. Complete self-contained phrases only.`;
  const user = `${focusInstructions(facts)}\n${groundingInstructions(facts)}\n\nFULL CURRENT SCRIPT (for context):\n${JSON.stringify(script)}\n\nREWRITE SCENE INDEX ${index} (kind "${current.kind}"). ${hint ? `Author's note: ${hint.slice(0, 300)}` : "Make it sharper, more specific, and better grounded in the data."}\n\nDATA:\n${JSON.stringify(slimFacts(facts))}`;
  return withFallback("scene rewrite", async (model) => {
    const scene = cleanScene(await chat(model, system, user, 800));
    scene.kind = current.kind;
    return scene;
  });
}

function numberTokens(s: string): number[] {
  const out: number[] = [];
  for (const m of s.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*([kKmM])?(?![\w.])/g)) {
    let n = Number(m[1]!.replace(/,/g, ""));
    if (Number.isNaN(n)) continue;
    if (m[2]?.toLowerCase() === "k") n *= 1000;
    if (m[2]?.toLowerCase() === "m") n *= 1_000_000;
    out.push(n);
  }
  return out;
}

function knownNumbers(facts: StoryFacts): number[] {
  const nums = new Set<number>([
    facts.stars, facts.forks, facts.openIssues, facts.contributors.length, facts.recentCommits.length,
    Object.keys(facts.languages).length, facts.topics.length, facts.releases.count,
  ]);
  const created = Date.parse(facts.createdAt);
  if (!Number.isNaN(created)) {
    const years = (Date.now() - created) / (365.25 * 86400e3);
    nums.add(Math.floor(years));
    nums.add(Math.round(years));
    nums.add(Math.ceil(years));
    nums.add(new Date(created).getUTCFullYear());
  }
  for (const v of Object.values(facts.languages)) nums.add(v);
  if (facts.code) nums.add(facts.code.fileCount), nums.add(facts.code.manifest?.dependencies.length ?? -1);
  for (const c of [facts.pr, facts.release?.changes, facts.compare]) {
    if (!c) continue;
    nums.add(c.additions), nums.add(c.deletions), nums.add(c.changedFiles), nums.add(c.additions + c.deletions);
    if ("totalCommits" in c) nums.add(c.totalCommits);
    if ("number" in c) nums.add(c.number);
  }
  for (const t of numberTokens(facts.readmeExcerpt + " " + (facts.release?.body ?? "") + " " + (facts.pr?.body ?? ""))) nums.add(t);
  return [...nums].filter((n) => n >= 0);
}

function matchesKnown(n: number, known: number[]): boolean {
  if (n < 10) return true;
  return known.some((k) => {
    if (k === n) return true;
    const tol = n >= 1_000_000 ? 0.06 : n >= 1000 ? 0.06 : 0.02;
    return Math.abs(k - n) <= Math.max(1, Math.abs(k) * tol);
  });
}

function norm(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

export function groundingWarnings(script: VideoScript, facts: StoryFacts): string[] {
  const warnings: string[] = [];
  const known = knownNumbers(facts);
  script.scenes.forEach((s, i) => {
    for (const st of s.stats ?? []) {
      for (const n of numberTokens(st.value)) {
        if (!matchesKnown(n, known)) warnings.push(`Scene ${i + 1}: stat "${st.value} ${st.label}" does not match any number in the repo data.`);
      }
    }
    for (const n of numberTokens(s.narration)) {
      if (n >= 100 && !matchesKnown(n, known)) warnings.push(`Scene ${i + 1}: narration mentions "${n}" which is not in the repo data.`);
    }
    if (s.kind === "code" && facts.code?.entry && facts.grounding !== "readme") {
      const snippet = facts.code.entry.lines.map(norm);
      const manifestNames = new Set([...(facts.code.manifest?.dependencies ?? []), ...facts.code.topLevel, ...Object.keys(facts.languages)].map(norm));
      const changed = [...(facts.pr?.files ?? []), ...(facts.release?.changes?.files ?? []), ...(facts.compare?.files ?? [])].map((f) => f.filename);
      const paths = new Set([...facts.code.topLevel, ...changed, ...changed.map((f) => f.split("/").pop() ?? f)].map(norm));
      for (const line of s.lines ?? []) {
        const nl = norm(line);
        if (nl.length < 3) continue;
        const looksLikeCode = /[(){};=<>[\]]|^(import|from|def|fn|func|class|const|let|var|use|package|require)\b/.test(line);
        const inSnippet = snippet.some((sl) => sl.includes(nl) || (nl.length > 12 && nl.includes(sl) && sl.length > 8));
        const inFacts = [...manifestNames, ...paths].some((m) => m && nl.includes(m));
        if (looksLikeCode && !inSnippet && !inFacts) warnings.push(`Scene ${i + 1}: code line "${line}" is not quoted from ${facts.code.entry.path} or the manifest.`);
      }
    }
  });
  return warnings;
}
