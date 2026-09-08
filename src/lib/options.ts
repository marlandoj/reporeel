export type Grounding = "readme" | "code" | "both";
export type Format = "landscape" | "vertical" | "square";

export type JobOptions = {
  grounding: Grounding;
  format: Format;
  captions: boolean;
  review: boolean;
};

export type FormatSpec = {
  w: number;
  h: number;
  ratio: string;
  label: string;
  platforms: string;
  lineMax: number;
  headingMax: number;
};

export const FORMATS: Record<Format, FormatSpec> = {
  landscape: { w: 1280, h: 720, ratio: "16:9", label: "Landscape", platforms: "YouTube, X, LinkedIn", lineMax: 46, headingMax: 40 },
  vertical: { w: 720, h: 1280, ratio: "9:16", label: "Vertical", platforms: "Shorts, Reels, TikTok", lineMax: 30, headingMax: 28 },
  square: { w: 1080, h: 1080, ratio: "1:1", label: "Square", platforms: "X feed, LinkedIn feed, Instagram", lineMax: 36, headingMax: 32 },
};

export const GROUNDINGS: Record<Grounding, string> = {
  readme: "README and repo metadata",
  code: "source tree, manifest, and entry file",
  both: "README plus source tree, manifest, and entry file",
};

const DEFAULTS: JobOptions = { grounding: "both", format: "landscape", captions: false, review: true };

export function normalizeOptions(raw: unknown): JobOptions {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const grounding = typeof r.grounding === "string" && r.grounding in GROUNDINGS ? (r.grounding as Grounding) : DEFAULTS.grounding;
  const format = typeof r.format === "string" && r.format in FORMATS ? (r.format as Format) : DEFAULTS.format;
  const captions = r.captions === undefined ? format !== "landscape" : r.captions === true || r.captions === "true" || r.captions === 1;
  const review = r.review === undefined ? DEFAULTS.review : r.review === true || r.review === "true" || r.review === 1;
  return { grounding, format, captions, review };
}

export function variantKey(o: JobOptions): string {
  return `${o.format}:${o.grounding}:${o.captions ? "cc" : "nocc"}`;
}

export function parseOptions(json: string | null | undefined): JobOptions {
  if (!json) return { ...DEFAULTS };
  try {
    return normalizeOptions(JSON.parse(json));
  } catch {
    return { ...DEFAULTS };
  }
}
