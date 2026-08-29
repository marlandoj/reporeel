import type { StoryFacts } from "./github";
import { log } from "./log";

export type Scene = {
  kind: "title" | "stats" | "text" | "list" | "code" | "outro";
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

const MODELS = [
  "anthropic/claude-sonnet-4.5",
  "google/gemini-2.5-flash",
  "openai/gpt-4o-mini",
];

const SYSTEM = `You write scripts for short narrated explainer videos about GitHub repositories.
Return ONLY a JSON object, no markdown fences, matching:
{
  "title": "repo display name",
  "tagline": "one line under 60 chars",
  "scenes": [
    {
      "kind": "title" | "stats" | "text" | "list" | "code" | "outro",
      "heading": "on-screen heading, under 40 chars",
      "lines": ["up to 3 short on-screen lines, each under 46 chars"],
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
- Narration must flow as one continuous voiceover when read scene after scene.
- Every on-screen line, heading, and tagline must be a complete self-contained phrase. Never split a sentence across lines or scenes, never end a line mid-thought.
- Title scene: lines[0] is the project display name, lines[1] is a complete tagline phrase.
- The outro narration ends with a short memorable closing line about the project.
- No emojis anywhere. Values like "12.4k" for numbers over 999.`;

function userPrompt(facts: StoryFacts): string {
  const slim = {
    ...facts,
    readmeExcerpt: facts.readmeExcerpt.slice(0, 5000),
  };
  const focus = facts.pr
    ? "Focus the story on the pull request: what it changes, why it matters, its scale. Use repo context as backdrop."
    : "Tell the story of this repository: what it is, why it exists, what stands out.";
  return `${focus}\n\nDATA:\n${JSON.stringify(slim)}`;
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

function validate(obj: any): VideoScript {
  if (!obj || typeof obj !== "object") throw new Error("script not an object");
  if (!Array.isArray(obj.scenes) || obj.scenes.length < 4 || obj.scenes.length > 8)
    throw new Error("bad scene count");
  for (const s of obj.scenes) {
    if (!s.heading || !s.narration || typeof s.narration !== "string")
      throw new Error("scene missing heading or narration");
    if (!["title", "stats", "text", "list", "code", "outro"].includes(s.kind)) s.kind = "text";
    if (s.lines && !Array.isArray(s.lines)) delete s.lines;
    if (s.stats && !Array.isArray(s.stats)) delete s.stats;
  }
  return {
    title: String(obj.title ?? "Untitled"),
    tagline: String(obj.tagline ?? ""),
    scenes: obj.scenes,
  };
}

async function callModel(model: string, facts: StoryFacts): Promise<VideoScript> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt(facts) },
      ],
      temperature: 0.6,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status} for ${model}`);
  const data: any = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`empty completion from ${model}`);
  return validate(JSON.parse(stripFences(content)));
}

export async function generateScript(facts: StoryFacts): Promise<VideoScript> {
  let lastErr: unknown;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callModel(model, facts);
      } catch (e) {
        lastErr = e;
        log(`script generation failed (${model}, attempt ${attempt + 1}): ${e}`);
      }
    }
  }
  throw new Error(`script generation failed on all models: ${lastErr}`);
}
