import { STYLES, type Style } from "./styles";

export type Grounding = "readme" | "code" | "both";
export type Format = "landscape" | "vertical" | "square";

export type JobOptions = {
  renderer?: "hyperframes" | "huashu-keynote";
  grounding: Grounding;
  format: Format;
  style: Style;
  plain: boolean;
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

const DEFAULTS: JobOptions = {
  grounding: "both",
  format: "landscape",
  style: "studio",
  plain: false,
  captions: false,
  review: true,
};

export function normalizeOptions(raw: unknown): JobOptions {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const grounding =
    typeof r.grounding === "string" && r.grounding in GROUNDINGS ? (r.grounding as Grounding) : DEFAULTS.grounding;
  const format = typeof r.format === "string" && r.format in FORMATS ? (r.format as Format) : DEFAULTS.format;
  const style = typeof r.style === "string" && r.style in STYLES ? (r.style as Style) : DEFAULTS.style;
  const plain = r.plain === true || r.plain === "true" || r.plain === 1;
  const captions =
    r.captions === undefined ? format !== "landscape" : r.captions === true || r.captions === "true" || r.captions === 1;
  const review = r.review === undefined ? DEFAULTS.review : r.review === true || r.review === "true" || r.review === 1;
  const renderer = r.renderer === "huashu-keynote" ? "huashu-keynote" : "hyperframes";
  return { grounding, format, style: renderer === "huashu-keynote" ? "studio" : style, plain, captions, review, renderer };
}

export function variantKey(o: JobOptions): string {
  return `${o.renderer === "huashu-keynote" ? "huashu-keynote:v1:" : ""}${o.format}:${o.style}:${o.grounding}:${o.plain ? "ste" : "std"}:${o.captions ? "cc" : "nocc"}`;
}

export function parseOptions(json: string | null | undefined): JobOptions {
  if (!json) return { ...DEFAULTS };
  try {
    return normalizeOptions(JSON.parse(json));
  } catch {
    return { ...DEFAULTS };
  }
}
