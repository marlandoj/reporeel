import {
  lintSte100,
  steWordCount,
  STE_RULE_REFERENCE,
  STE_MODES,
  type SteReport,
  type RewriteMode,
} from "./ste100";

/* ------------------------------------------------------------------ *
 * Operator surface for /ste100
 * ------------------------------------------------------------------ */

export const STE_SECTIONS = [
  { id: "Words", title: "Section 1 — Words" },
  { id: "Multi-word nouns", title: "Section 2 — Multi-word nouns" },
  { id: "Verbs", title: "Section 3 — Verbs" },
  { id: "Sentences", title: "Section 4 — Sentences" },
  { id: "Procedural", title: "Section 5 — Procedural writing" },
  { id: "Descriptive", title: "Section 6 — Descriptive writing" },
  { id: "Safety", title: "Section 7 — Safety instructions" },
  { id: "Punctuation", title: "Section 8 — Punctuation and word count" },
  { id: "Practices", title: "Section 9 — Writing practices" },
];

export type SteRuleRow = { id: string; section: string; text: string; mechanical: boolean };

const SECTION_ID: Record<string, string> = {
  Words: "Words",
  "Multi-word nouns": "Multi-word nouns",
  Verbs: "Verbs",
  Sentences: "Sentences",
  Procedural: "Procedural",
  Descriptive: "Descriptive",
  Safety: "Safety",
  Punctuation: "Punctuation",
  Practices: "Practices",
};

/** Rules the linter proves, plus the rest of Issue 9 listed for context. */
export const STE_RULES: SteRuleRow[] = [
  { id: "1.1", section: "Words", text: "Use only approved words, technical nouns, or technical verbs.", mechanical: true },
  { id: "1.2", section: "Words", text: "Use an approved word only as its listed part of speech.", mechanical: false },
  { id: "1.3", section: "Words", text: "Use an approved word only with its approved meaning.", mechanical: false },
  { id: "1.4", section: "Words", text: "Use only the approved forms of verbs and adjectives.", mechanical: true },
  { id: "1.5", section: "Words", text: "You can use domain words as technical nouns, for example webhook or commit.", mechanical: false },
  { id: "1.6", section: "Words", text: "Use an unapproved word only when it is a technical noun or part of one.", mechanical: false },
  { id: "1.7", section: "Words", text: "Do not use technical nouns as verbs.", mechanical: false },
  { id: "1.8", section: "Words", text: "Use the technical nouns of your project or industry.", mechanical: false },
  { id: "1.9", section: "Words", text: "When you pick a technical noun, pick a short and clear one.", mechanical: false },
  { id: "1.10", section: "Words", text: "No regional, slang, or jargon words as technical nouns.", mechanical: false },
  { id: "1.11", section: "Words", text: "One item, one name. Do not call it config here and settings there.", mechanical: true },
  { id: "1.12", section: "Words", text: "You can use domain verbs as technical verbs, for example deploy or merge.", mechanical: false },
  { id: "1.13", section: "Words", text: "Do not use technical verbs as nouns.", mechanical: false },
  { id: "1.14", section: "Words", text: "Use American English spelling.", mechanical: true },
  { id: "2.1", section: "Multi-word nouns", text: "Write multi-word nouns of three words or fewer.", mechanical: true },
  { id: "2.2", section: "Multi-word nouns", text: "Write a long technical noun in full once, then give a short form.", mechanical: false },
  { id: "3.1", section: "Verbs", text: "Use only the verb forms that the dictionary gives.", mechanical: false },
  { id: "3.2", section: "Verbs", text: "Use only the infinitive, imperative, simple present, simple past, simple future, and participle as adjective.", mechanical: false },
  { id: "3.3", section: "Verbs", text: "Use the past participle only as an adjective, for example the cached response.", mechanical: false },
  { id: "3.4", section: "Verbs", text: "No auxiliary verbs for complex constructions. No present perfect, no is to be installed.", mechanical: true },
  { id: "3.5", section: "Verbs", text: "Use an -ing form only as a technical noun or inside one, never as a verb.", mechanical: true },
  { id: "3.6", section: "Verbs", text: "Active voice. Passive is legal only when the agent is unknown.", mechanical: true },
  { id: "3.7", section: "Verbs", text: "Describe an action with a verb, not a noun.", mechanical: true },
  { id: "4.1", section: "Sentences", text: "Write short and clear sentences.", mechanical: false },
  { id: "4.2", section: "Sentences", text: "Do not omit words or use contractions to shorten sentences. Keep articles, keep that.", mechanical: true },
  { id: "4.3", section: "Sentences", text: "Use a vertical list for complex text.", mechanical: true },
  { id: "4.4", section: "Sentences", text: "Use connecting words between sentences on related topics.", mechanical: true },
  { id: "4.5", section: "Sentences", text: "Put an article or a demonstrative adjective before the noun where applicable.", mechanical: true },
  { id: "5.1", section: "Procedural", text: "Maximum 20 words per sentence. Warnings and cautions included.", mechanical: true },
  { id: "5.2", section: "Procedural", text: "One instruction per sentence, unless two actions happen at the same time.", mechanical: true },
  { id: "5.3", section: "Procedural", text: "Write instructions in the imperative.", mechanical: true },
  { id: "5.4", section: "Procedural", text: "Put a required condition before the command, divided by a comma.", mechanical: true },
  { id: "5.5", section: "Procedural", text: "Notes give information, never instructions. Notes get the 25-word limit.", mechanical: true },
  { id: "6.1", section: "Descriptive", text: "Give information gradually, one subject per sentence.", mechanical: false },
  { id: "6.2", section: "Descriptive", text: "Use key words and phrases to give the text a logical structure.", mechanical: false },
  { id: "6.3", section: "Descriptive", text: "Maximum 25 words per sentence.", mechanical: true },
  { id: "6.4", section: "Descriptive", text: "Group related information in paragraphs.", mechanical: false },
  { id: "6.5", section: "Descriptive", text: "One topic per paragraph.", mechanical: false },
  { id: "6.6", section: "Descriptive", text: "Maximum six sentences per paragraph.", mechanical: true },
  { id: "7.1", section: "Safety", text: "Use a word that shows the risk level, for example WARNING or CAUTION.", mechanical: false },
  { id: "7.2", section: "Safety", text: "Start with a clear command or condition.", mechanical: false },
  { id: "7.3", section: "Safety", text: "Then give the risk or the possible result.", mechanical: false },
  { id: "8.1", section: "Punctuation", text: "All standard punctuation is legal except the semicolon. Write two sentences instead.", mechanical: true },
  { id: "8.2", section: "Punctuation", text: "Use hyphens to connect words that act as one unit.", mechanical: false },
  { id: "8.3", section: "Punctuation", text: "Parentheses are legal for references, item numbers, abbreviations, plurals, explanations, and alternatives.", mechanical: false },
  { id: "8.4", section: "Punctuation", text: "In a vertical list, the lead-in colon ends a sentence for word count.", mechanical: false },
  { id: "8.5", section: "Punctuation", text: "Text inside parentheses counts as one word.", mechanical: false },
  { id: "8.6", section: "Punctuation", text: "Count as one word each: numbers, numbers with units, abbreviations, identifiers, quoted text, titles, labels, and proper nouns.", mechanical: true },
  { id: "8.7", section: "Punctuation", text: "A hyphenated word counts as one word.", mechanical: false },
  { id: "9.1", section: "Practices", text: "When a word-for-word replacement does not work, restructure the sentence.", mechanical: true },
  { id: "9.2", section: "Practices", text: "Use each approved word with its approved meaning and part of speech.", mechanical: false },
  { id: "9.3", section: "Practices", text: "Do not build phrasal verbs. Write decrease, not go down.", mechanical: true },
  { id: "9.4", section: "Practices", text: "Keep one consistent style and terminology through the whole document.", mechanical: true },
  { id: "GR-1", section: "Practices", text: "Keep the conjunction that.", mechanical: false },
  { id: "GR-2", section: "Practices", text: "Be careful with with.", mechanical: false },
  { id: "GR-3", section: "Practices", text: "Give pronouns a clear referent.", mechanical: false },
  { id: "GR-4", section: "Practices", text: "Prefer this plus a noun over a bare this.", mechanical: false },
  { id: "GR-5", section: "Practices", text: "Avoid false friends between languages.", mechanical: false },
  { id: "GR-6", section: "Practices", text: "Avoid Latin abbreviations. Write for example, that is, and name the items instead of etc.", mechanical: true },
  { id: "GR-7", section: "Practices", text: "Use inclusive language.", mechanical: true },
  { id: "GR-8", section: "Practices", text: "Use the possessive apostrophe form only when you are sure it is correct.", mechanical: false },
];

const LABEL_OVERRIDE: Record<string, string> = {
  "8.6": "A number, unit, identifier, or quoted string must count as one word.",
  GR: "",
};

export type SteView = {
  sentenceCount: number;
  flaggedSentences: number;
  errors: number;
  warnings: number;
  words: number;
  longestSentence: number;
  byRule: { rule: string; label: string; count: number }[];
};

function ruleLabel(rule: string, fallback: string): string {
  const row = STE_RULES.find((r) => r.id === rule);
  if (row) return LABEL_OVERRIDE[rule] || row.text;
  return fallback;
}

export function toView(rep: SteReport): SteView {
  const byRule = rep.findings.map((f) => ({
    rule: f.rule,
    label: ruleLabel(f.rule, f.message),
    count: f.count,
  }));
  const flagged = new Set(rep.findings.map((f) => f.excerpt)).size;
  return {
    sentenceCount: rep.sentences,
    flaggedSentences: Math.min(rep.sentences, flagged),
    errors: rep.errors,
    warnings: rep.warnings,
    words: rep.words,
    longestSentence: rep.longestSentence,
    byRule,
  };
}

export function lintText(text: string, output = ""): SteView & { output: string } {
  return { ...toView(lintSte100(text)), output };
}

/* ------------------------------------------------------------------ *
 * AI rewrite
 * ------------------------------------------------------------------ */

const MODELS = [
  "anthropic/claude-sonnet-4.5",
  "google/gemini-2.5-flash",
  "openai/gpt-4o-mini",
];

const TONE: Record<string, string> = {
  keep: "",
  formal: "Write the result as a formal technical report. Use neutral, factual prose.",
  friendly: "Write the result as friendly developer documentation. Use short sentences and a warm, direct tone.",
};

function modeFor(strength: string): RewriteMode {
  if (strength === "strict") return "strict";
  if (strength === "light") return "light";
  return "eighty";
}

export function steStrengths(): { id: string; label: string; blurb: string }[] {
  return (Object.keys(STE_MODES) as RewriteMode[]).map((k) => ({ id: k, label: STE_MODES[k].label, blurb: STE_MODES[k].blurb }));
}

async function chat(system: string, user: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELS[0],
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    }),
  });
  if (!res.ok) throw new Error(`The rewrite model returned ${res.status}. Try Check only.`);
  const data: any = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("The rewrite model returned an empty answer.");
  return String(content);
}

export async function rewritePlain(text: string, strength = "soft", tone = "keep"): Promise<string> {
  const mode = modeFor(strength);
  const system = [
    "You rewrite technical text in Simplified Technical English (ASD-STE100, Issue 9).",
    STE_MODES[mode].instruction,
    TONE[tone] || TONE.keep || "",
    "Return ONLY the rewritten text. Keep the original heading markers (#, ##) and list markers if the input has them.",
    "Return no commentary, no explanation, and no markdown fences.",
  ]
    .filter(Boolean)
    .join("\n");
  const user = `Rewrite this text.\n\n${text}`;
  let out = "";
  for (const model of MODELS) {
    try {
      out = await chat(system.replace("anthropic/claude-sonnet-4.5", model), user);
      break;
    } catch {
      continue;
    }
  }
  if (!out) throw new Error("The rewrite could not run on any configured model. Use Check only.");
  return stripFences(out).trim();
}

function stripFences(s: string): string {
  return s.replace(/^```(?:[a-z]*)?\s*/i, "").replace(/```\s*$/, "").trim();
}

/* ------------------------------------------------------------------ *
 * Quick reference
 * ------------------------------------------------------------------ */

const REFERENCE_INTRO =
  "This is a practical subset of the 53 writing rules in ASD-STE100 Issue 9, paraphrased for software documentation. " +
  "The check is mechanical: it proves what a program can prove, not what a judge would decide. " +
  "Full compliance needs the official dictionary, a free download from asd-ste100.org. " +
  "ASD-STE100 is a registered trademark of ASD. RepoReel is an unofficial aid and is not affiliated with or endorsed by ASD.";

export function steQuickReference(): { title: string; intro: string; html: string; markdown: string } {
  const groups = STE_SECTIONS.map((s) => {
    const rows = STE_RULES.filter((r) => SECTION_ID[r.section] === s.id);
    if (!rows.length) return "";
    const trs = rows
      .map(
        (r) =>
          `<tr><td class="r">${r.id}</td><td>${r.text}</td><td class="m">${r.mechanical ? "mechanical" : "judgement"}</td></tr>`
      )
      .join("");
    return `<h2>${s.title}</h2><table><thead><tr><th class="r">Rule</th><th>Instruction</th><th class="m">Checked</th></tr></thead><tbody>${trs}</tbody></table>`;
  }).join("\n");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>ASD-STE100 Quick Reference</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  body { font: 11pt/1.45 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #14202e; }
  h1 { font-size: 20pt; margin: 0 0 4px; letter-spacing: -.01em; }
  .sub { color: #5b6b7d; font-size: 9.5pt; margin: 0 0 12px; }
  .intro { background: #f3f6f9; border-left: 3px solid #3a7ca5; padding: 10px 12px; margin: 0 0 18px; font-size: 9.5pt; color: #2c3a48; }
  h2 { font-size: 11.5pt; margin: 16px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #d6dee6; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th { text-align: left; color: #5b6b7d; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .08em; border-bottom: 1px solid #d6dee6; padding: 4px 6px; }
  td { padding: 4px 6px; border-bottom: 1px solid #eef2f6; vertical-align: top; }
  td.r, th.r { width: 46px; font-weight: 700; color: #3a7ca5; white-space: nowrap; }
  td.m, th.m { width: 74px; color: #7b8a99; font-size: 8.5pt; }
  .foot { margin-top: 20px; padding-top: 8px; border-top: 1px solid #d6dee6; color: #7b8a99; font-size: 8.5pt; }
</style></head><body>
<h1>ASD-STE100 Quick Reference</h1>
<p class="sub">Simplified Technical English &middot; Issue 9 writing rules &middot; ${STE_RULES.length} rows</p>
<p class="intro">${REFERENCE_INTRO}</p>
${groups}
<p class="foot">RepoReel &middot; https://reporeel-marlandoj.zocomputer.io/ste100 &middot; Official standard: https://asd-ste100.org</p>
</body></html>`;

  const md = [
    "# ASD-STE100 Quick Reference",
    "",
    REFERENCE_INTRO,
    "",
    ...STE_SECTIONS.flatMap((s) => {
      const rows = STE_RULES.filter((r) => SECTION_ID[r.section] === s.id);
      if (!rows.length) return [];
      return [
        `## ${s.title}`,
        "",
        "| Rule | Instruction | Checked |",
        "| --- | --- | --- |",
        ...rows.map((r) => `| ${r.id} | ${r.text} | ${r.mechanical ? "mechanical" : "judgement"} |`),
        "",
      ];
    }),
    `RepoReel · Official standard: https://asd-ste100.org`,
    "",
  ].join("\n");

  return { title: "ASD-STE100 Quick Reference", intro: REFERENCE_INTRO, html, markdown: md };
}

/* ------------------------------------------------------------------ *
 * Sample check used on the printed quick reference
 * ------------------------------------------------------------------ */

const SAMPLE = `When the retry limit is reached, the client aborts the request.
You can increase the timeout in the configuration file. This functionality is designed to make the client more robust.`;

export function checkSamples(): { html: string; flagged: number; total: number } {
  const v = lintText(SAMPLE);
  const rows = v.byRule
    .map((g) => `<tr><td class="r">${g.rule}</td><td>${g.label}</td><td class="c">${g.count}</td></tr>`)
    .join("");
  return {
    html:
      `<p class="lead">The same text through this linter. Two sentences, ${v.errors} errors, ${v.warnings} warnings, longest sentence ${v.longestSentence} words.</p>` +
      `<div class="sample"><p>${SAMPLE}</p></div>` +
      (rows
        ? `<table><thead><tr><th class="r">Rule</th><th>Finding</th><th class="c">Count</th></tr></thead><tbody>${rows}</tbody></table>`
        : `<p>No mechanical findings.</p>`),
    flagged: v.flaggedSentences,
    total: v.sentenceCount,
  };
}

export { STE_RULE_REFERENCE, steWordCount };
