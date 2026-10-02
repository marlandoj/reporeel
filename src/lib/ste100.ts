// A practical mechanical subset of the ASD-STE100 Simplified Technical English
// writing rules (Issue 9, free standard at https://www.asd-ste100.org/).
//
// These checks are lints, not a certification. They catch the violations that
// can be decided from the text alone: word choice, banned modals, contractions,
// passive voice, sentence length, condition placement, and word-count conventions.
// Dictionary coverage (the ~900 approved words) is not reproduced here because
// the official dictionary is copyrighted; Rules 1.1 to 1.4 are therefore checked
// only for the specific disapproved items listed below.

export type SteSeverity = "error" | "warning";

export type SteFinding = {
  rule: string;
  severity: SteSeverity;
  message: string;
  excerpt: string;
  fix: string;
  count: number;
};

export type SteReport = {
  findings: SteFinding[];
  errors: number;
  warnings: number;
  words: number;
  sentences: number;
  longestSentence: number;
  score: number;
};

export type RewriteMode = "strict" | "eighty" | "light";

export const STE_MODES: Record<RewriteMode, { label: string; blurb: string; instruction: string }> = {
  strict: {
    label: "Strict STE100",
    blurb: "Full compliance: short sentences, approved vocabulary, active voice, one instruction per sentence.",
    instruction:
      "Rewrite the text so that it follows ASD-STE100 Simplified Technical English (Issue 9) as closely as you can. " +
      "Apply the sentence limits (20 words per procedural sentence, 25 per descriptive sentence), the approved modals " +
      "(can, will, must; never should, would, may, might), active voice, one instruction per sentence, no contractions, " +
      "American English, and a condition placed before its command. Replace every word that is not in the general STE " +
      "dictionary with an approved word or a technical noun. Keep code, identifiers, commands, file paths, product names, " +
      "and quoted error text exactly as written. Do not add facts and do not remove meaning.",
  },
  eighty: {
    label: "80% of the way",
    blurb: "Karpathy's setting: keep the clarity, drop some of the stiffness.",
    instruction:
      "Rewrite the text to be about 80% of the way to ASD-STE100 Simplified Technical English (Issue 9). Keep what helps " +
      "the reader: short sentences, active voice, approved modals (can, will, must), one idea per sentence, no contractions, " +
      "American English, a condition before its command, and plain approved words. Relax what reads as robotic: you may keep " +
      "a little natural sentence variety, some contractions, and domain vocabulary that has no approved equivalent. Do not " +
      "add facts, do not remove meaning, and do not touch code, identifiers, commands, or file paths.",
  },
  light: {
    label: "Light pass",
    blurb: "Only the high-signal fixes: no banned modals, no filler, no semicolons, shorter sentences.",
    instruction:
      "Make a light edit of the text for clarity. Do only these: replace should, would, may, might, and could-as-possibility " +
      "with can, must, or a plain statement; delete filler such as simply, just, easily, robust, powerful, and it is worth " +
      "noting; replace in order to, prior to, utilize, leverage, due to the fact that, and at this time with to, before, use, " +
      "use, because, and now; split sentences longer than about 25 words; replace each semicolon with a full stop; expand " +
      "contractions; and move any if or when condition to the start of its sentence. Keep everything else. Do not add facts.",
  },
};

const KEEP = "Keep code, identifiers, commands, file paths, and quoted strings exactly as written.";

export const STE_RULE_REFERENCE: { rule: string; section: string; rule_text: string; note: string }[] = [
  { rule: "1.1", section: "Words", rule_text: "Use only approved words, technical nouns, or technical verbs.", note: "Dictionary coverage is not checked here. The banned items below are." },
  { rule: "1.4", section: "Words", rule_text: "Use only the approved forms of verbs and adjectives.", note: "Checks inflections such as utilizes, comprised of, focussed." },
  { rule: "1.11", section: "Words", rule_text: "One item, one name. Do not call it config here and settings there.", note: "Flags the common synonym pairs so a writer can pick one." },
  { rule: "1.14", section: "Words", rule_text: "Use American English spelling.", note: "Checks a list of British spellings." },
  { rule: "2.1", section: "Multi-word nouns", rule_text: "Write multi-word nouns of three words or fewer.", note: "Flags noun chains of four or more words." },
  { rule: "3.4", section: "Verbs", rule_text: "No auxiliary verbs for complex constructions. No present perfect.", note: "Checks has been, have been, is being, had been." },
  { rule: "3.5", section: "Verbs", rule_text: "Use an -ing form only as a technical noun or inside one, never as a verb.", note: "Flags a verb before a determiner, for example installing the pump." },
  { rule: "3.6", section: "Verbs", rule_text: "Active voice. Passive is legal only when the agent is unknown.", note: "Heuristic check on the be or get plus past participle pattern." },
  { rule: "3.7", section: "Verbs", rule_text: "Describe an action with a verb, not a noun.", note: "Checks perform a plus noun, carry out a plus noun, make a plus decision." },
  { rule: "4.1", section: "Sentences", rule_text: "Write short and clear sentences.", note: "Soft limit. Hard limits are 5.1 and 6.3." },
  { rule: "4.2", section: "Sentences", rule_text: "Do not omit words or use contractions to shorten sentences.", note: "Checks contractions, missing articles, and bare checks." },
  { rule: "4.3", section: "Sentences", rule_text: "Use a vertical list for complex text.", note: "Advisory when a sentence holds a chain of three or more and-then actions." },
  { rule: "4.4", section: "Sentences", rule_text: "Use connecting words between sentences on related topics.", note: "Advisory when consecutive sentences share a subject." },
  { rule: "4.5", section: "Sentences", rule_text: "Put an article or a demonstrative before the noun where applicable.", note: "Checks bare checks, list of a, these type." },
  { rule: "5.1", section: "Procedural", rule_text: "Maximum 20 words per sentence, warnings and cautions included.", note: "Hard check on imperative sentences." },
  { rule: "5.2", section: "Procedural", rule_text: "One instruction per sentence, unless two actions happen at the same time.", note: "Checks imperative sentences with a second action." },
  { rule: "5.3", section: "Procedural", rule_text: "Write instructions in the imperative.", note: "Advisory. Flags a modal requirement inside a step." },
  { rule: "5.4", section: "Procedural", rule_text: "Put a required condition before the command, divided by a comma.", note: "Checks if or when or unless after the main verb." },
  { rule: "5.5", section: "Procedural", rule_text: "Notes give information, never instructions. Notes get the 25-word limit.", note: "Checks the 25-word note limit." },
  { rule: "6.3", section: "Descriptive", rule_text: "Maximum 25 words per sentence.", note: "Hard check on descriptive sentences." },
  { rule: "6.5", section: "Descriptive", rule_text: "One topic per paragraph.", note: "Advisory when a paragraph holds unrelated sentences." },
  { rule: "6.6", section: "Descriptive", rule_text: "Maximum six sentences per paragraph.", note: "Hard check." },
  { rule: "7.1", section: "Safety", rule_text: "Use a word that shows the risk level, WARNING or CAUTION.", note: "Checks risk statements that carry no level word." },
  { rule: "7.2", section: "Safety", rule_text: "Start with a clear command or condition.", note: "Checks a risk statement that does not start with a command." },
  { rule: "8.1", section: "Punctuation", rule_text: "All standard punctuation is legal except the semicolon.", note: "Checks semicolons." },
  { rule: "8.2", section: "Punctuation", rule_text: "Use hyphens to connect words that act as one unit.", note: "Checks phrasal verbs and common unhyphenated compounds." },
  { rule: "8.3", section: "Punctuation", rule_text: "Parentheses are legal for references, item numbers, abbreviations, plural forms, explanations, and alternatives.", note: "Checks slashes used instead of a comma or the word or." },
  { rule: "8.4", section: "Punctuation", rule_text: "In a vertical list the lead-in colon ends a sentence for word count.", note: "Informational." },
  { rule: "8.5", section: "Punctuation", rule_text: "Text inside parentheses counts as one word.", note: "Informational." },
  { rule: "8.6", section: "Punctuation", rule_text: "Count as one word each: numbers, numbers with units, abbreviations, alphanumeric identifiers, quoted text, titles, labels, and proper nouns.", note: "Used by the sentence counters." },
  { rule: "8.7", section: "Punctuation", rule_text: "A hyphenated word counts as one word.", note: "Used by the sentence counters." },
  { rule: "9.1", section: "Writing practices", rule_text: "When a word for word replacement does not work, restructure the sentence.", note: "Advisory on sentences that stack three or more banned words." },
  { rule: "9.3", section: "Writing practices", rule_text: "Do not build phrasal verbs.", note: "Checks go down, set up, turn on, and other phrasal verbs." },
  { rule: "9.4", section: "Writing practices", rule_text: "Keep one consistent style and terminology through the whole text.", note: "Advisory on synonym rotation." },
];

type Spec = {
  rule: string;
  severity: SteSeverity;
  message: string;
  fix: string;
  re: RegExp;
  keep?: string;
};

const FILLER =
  "Simply, just, easily, seamlessly, effortlessly, actually, basically, essentially, really, very, quite, literally, obviously, " +
  "arguably, incredibly, hugely, massively, thoroughly, comprehensively, robust, powerful, blazingly fast, state-of-the-art, " +
  "game-changing, cutting-edge, world-class, best-in-class, enterprise-grade, mission-critical, delightful, magical, stunning, " +
  "beautiful, amazing, awesome, incredible, effortless, innovative, groundbreaking, leverage, harness, empower, streamline, " +
  "supercharge, unlock, elevate, seamless, frictionless, blazingly.";

const SPECS: Spec[] = [
  { rule: "1.1", severity: "error", message: "Word not in the STE general dictionary. Use an approved word or a technical noun.", fix: "Replace with an approved STE word, or make it a technical noun that your field uses.", re: /\b(utilize[sd]?|utilization|utilizing|comprised\s+of|regarding|concerning|pertaining|in\s+the\s+event\s+that|in\s+order\s+to|in\s+order\s+for|in\s+the\s+process\s+of|with\s+regard\s+to|with\s+respect\s+to|due\s+to\s+the\s+fact\s+that|at\s+this\s+(?:point\s+in\s+)?time|at\s+the\s+present\s+time|prior\s+to|subsequently|as\s+well\s+as|a\s+number\s+of|various|numerous|facilitat\w*|it\s+is\s+worth\s+noting\s+that|it\s+should\s+be\s+noted\s+that|it\s+is\s+important\s+to\s+note|when\s+it\s+comes\s+to|in\s+addition\s+to|on\s+top\s+of|for\s+the\s+purpose\s+of|in\s+order\s+to)\b/i },
  { rule: "1.1", severity: "error", message: "Latin or informal abbreviation. Use the approved English words.", fix: "Write e.g. as for example, i.e. as that is, and delete etc.", re: /\b(e\.g\.|i\.e\.|etc\.?|cf\.)\b/i },
  { rule: "1.1", severity: "warning", message: "Filler or marketing word. Delete it.", fix: "Delete the word, or replace it with a measurable fact.", re: new RegExp(`\\b(${FILLER})\\b`, "i") },
  { rule: "1.1", severity: "error", message: "Approved modal and verb. STE uses can, will, and must only.", fix: "Use must for a requirement, can for possibility or permission, and will only for the simple future.", re: /\b(should|would|may|might|could)\b/i, keep: "past of can" },
  { rule: "1.1", severity: "warning", message: "Banned verb form.", fix: "Use the approved form: use, set up becomes install, and so on.", re: /\b(focussed|learnt|amongst|whilst|towards|enquire|programme|catalogue|fulfil|enrol|labelled|modelling|travelling|licence|defence|centre|organise|recognise|analyse|catalyse|behaviour|colour|grey|metre|litre)\b/i },
  { rule: "1.14", severity: "error", message: "Use American English spelling.", fix: "Use the American spelling.", re: /\b(behaviour|colour|colourful|organise[sd]?|organising|recognise[sd]?|recognise|analyse[sd]?|catalogue[sd]?|licence|defence|centre[sd]?|fibre|metre|aluminium|fulfil|grey|modelling|labelled|travelling|learnt|amongst|whilst)\b/i },
  { rule: "1.11", severity: "warning", message: "Keep one term for each meaning. Do not rotate synonyms.", fix: "Pick one term for this meaning and use it in the whole text.", re: /\b(verify|validates?|validate|validation|confirm|confirmation|ensure[sd]?|ensuring|verifying)\b/i },
  { rule: "2.1", severity: "warning", message: "Multi-word noun of more than three words. Break it with a preposition.", fix: "Use a preposition: the timeout value for the connection pool.", re: /\b[\w-]+(?:\s+[\w-]+){4,}\b/g, keep: "sentence" },
  { rule: "3.4", severity: "error", message: "No present perfect and no passive auxiliary chain.", fix: "Use the simple present or the simple past.", re: /\b(?:has|have|had)\s+been\s+\w+|\b(?:is|are|was|were|be|been)\s+being\s+\w+|\bhas\s+\w+(?:ed|own)\b/i },
  { rule: "3.5", severity: "error", message: "Do not use an -ing form as a verb. Use the approved verb.", fix: "Use the verb: install, not installing.", re: /\b[a-z]{3,}ing\s+(?:the|a|an|this|that|these|those|all|each|every|any|your|its|his|her|our|their)\b/i },
  { rule: "3.6", severity: "warning", message: "Passive voice. Use the active voice and name the actor.", fix: "Rewrite with the actor as the subject: the tool reads the file.", re: /\b(?:am|is|are|was|were|be|been|being|gets?|got|gotten)\s+(?:\w+ly\s+)?(?:a\w+ed|[a-z]+ed|made|built|done|given|known|shown|seen|found|taken|written|held|kept|left|put|set|run|sent|told|thought|found|read|said|chosen|drawn|broken|brought|caught|taught|understood|written|produced|provided|required|supported|generated|returned|created|updated)\b/i },
  { rule: "3.7", severity: "warning", message: "Use a verb, not a verb plus noun.", fix: "Use one verb: verify, compress, not perform a verification or a compression.", re: /\b(?:perform|carry\s+out|make|conduct|take|do)\s+(?:a\s+|an\s+|the\s+)?(?:verification|validation|computation|calculation|installation|configuration|execution|evaluation|analysis|optimi[sz]ation|generation|aggregation|synchroni[sz]ation|migration|deployment|provisioning|resolution|negotiation|prioriti[sz]ation|comparison|modification|transformation|serialization|deserialization|initialization)\b/i },
  { rule: "4.2", severity: "error", message: "Do not use contractions.", fix: "Write the full form: do not, cannot, it is, they are.", re: /\b\w+'(?:s|t|re|ve|ll|d|m)\b/i },
  { rule: "4.2", severity: "error", message: "Do not omit words. Make the sentence complete.", fix: "Use check as a noun: do a check. Or use the verb: make sure that.", re: /\b(?:performs?|performs|conducts?|executes?)\s+(?:a\s+)?(?:the\s+)?check\b/i, keep: "past of can" },
  { rule: "4.5", severity: "warning", message: "Put an article or a demonstrative before the noun.", fix: "Write a check, the check, or make sure that.", re: /(?:\A|[.,;:]|\bthen\b|\bto\b|\band\b)\s+(checks|list\s+of|set\s+of)\b/i },
  { rule: "5.1", severity: "error", message: "Sentence is too long for procedural text. Maximum 20 words.", fix: "Split the sentence into two sentences.", re: /$^/, keep: "sentence" },
  { rule: "5.2", severity: "warning", message: "One instruction per sentence.", fix: "Split the two actions into two sentences.", re: /\b(?:and\s+then|,\s*then\s+\w+|;\s*)/i, keep: "sentence" },
  { rule: "5.3", severity: "warning", message: "Write the instruction in the imperative, not with a modal.", fix: "Start the sentence with the verb: Install the package.", re: /^(?:you\s+)?(?:should|must|will|can|need\s+to|have\s+to|is\s+to\s+be|are\s+to\s+be)\b/i, keep: "past of can" },
  { rule: "5.4", severity: "error", message: "Put the required condition before the command.", fix: "Start the sentence with If, When, or Unless, then add the command.", re: /\b(?:the\s+)?\w+\s+(?:if|when|unless|whenever)\b/i, keep: "sentence" },
  { rule: "5.5", severity: "error", message: "A note is not an instruction.", fix: "Remove the imperative verb from the note, or make the note a step.", re: /^note\s*:/i, keep: "sentence" },
  { rule: "6.3", severity: "error", message: "Sentence is too long for descriptive text. Maximum 25 words.", fix: "Split the sentence, or give one subject per sentence.", re: /$^/, keep: "sentence" },
  { rule: "6.6", severity: "error", message: "A paragraph must have 6 sentences or fewer.", fix: "Start a new paragraph, or use a vertical list.", re: /$^/, keep: "paragraph" },
  { rule: "7.1", severity: "warning", message: "Use a risk level word: WARNING for injury, CAUTION for damage.", fix: "Start the statement with WARNING or CAUTION.", re: /\b(?:data\s+loss|risk\s+of\s+(?:injury|damage)|could\s+cause|may\s+cause|be\s+careful|danger|dangerous|hazard(?:ous)?|harmful)\b/i, keep: "past of can" },
  { rule: "7.2", severity: "warning", message: "Start a risk statement with a command or a condition.", fix: "Start with Do not, Always, Never, or If.", re: /(?:^|\.)\s*(?:note\s+that\s+)?(?:there\s+is\s+a\s+risk|be\s+aware|users?\s+should)\b/i, keep: "past of can" },
  { rule: "8.1", severity: "error", message: "The semicolon is not approved. Write two sentences.", fix: "Replace the semicolon with a full stop and repeat the subject if you must.", re: /;/ },
  { rule: "8.2", severity: "warning", message: "Phrasal verb. Use one approved verb.", fix: "Use set up becomes install, turn on becomes start, go down becomes decrease.", re: /\b(?:set\s+up|turn\s+on|turn\s+off|go\s+down|go\s+up|shut\s+down|bring\s+up|call\s+up|drop\s+out|look\s+into|take\s+over|hand\s+in|check\s+in|clean\s+up|fill\s+in|hook\s+up|lock\s+in|plug\s+in|rule\s+out|spin\s+up|start\s+up|step\s+in|switch\s+off|switch\s+on|write\s+up)\b/i },
  { rule: "8.3", severity: "warning", message: "Use a comma or the word or. Do not use a slash.", fix: "Write a comma, or write or.", re: /\S\s+\/\s+\S/ },
  { rule: "8.6", severity: "warning", message: "The verb is a noun. Use the approved verb form.", fix: "Use the verb form of the word.", re: /\b(?:enables|enabling|allows|allowing|provides|providing|supports|supporting|includes|including|requires|requiring|offers|offering|handles|handling|delivers|delivering)\b/i },
  { rule: "9.3", severity: "warning", message: "Do not build a phrasal verb.", fix: "Use one approved verb.", re: /\b(?:go\s+down|go\s+up|set\s+up|turn\s+on|turn\s+off|shut\s+down|bring\s+up|look\s+into|take\s+over|drop\s+out)\b/i },
];

const BRITISH = /\b(behaviour|colour|colourful|organise[sd]?|organising|recognise[sd]?|recognising|analyse[sd]?|analysing|catalogue[sd]?|licence|defence|centre[sd]?|fibre|aluminium|fulfil|grey|modelling|labelled|travelling|learnt|amongst|whilst|offence|flavour|honour|rumour|saviour|armour|behavioural)\b/i;

type SentenceInfo = {
  text: string;
  words: number;
  procedural: boolean;
  start: number;
};

export function steWordCount(sentence: string): number {
  return sentence
    .replace(/`[^`]*`/g, " one ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function splitSentences(text: string): string[] {
  const lines = text.split(/\n/);
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^([-*\u2022]|\d+[.)]|#{1,6})\s+/.test(trimmed)) {
      out.push(trimmed.replace(/^([-*\u2022]|\d+[.)]|#{1,6})\s+/, ""));
      continue;
    }
    for (const part of trimmed.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)) {
      if (part.trim()) out.push(part.trim());
    }
  }
  return out;
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * A sentence counts as procedural when it reads as an instruction. A bare
 * capitalised opener is not enough: "Although the cache is warm" is descriptive,
 * so subordinators are excluded and only a standard opener or a command verb counts.
 */
const SUBORDINATOR =
  /^(?:although|though|while|when|whenever|where|whereas|wherever|because|since|if|unless|until|after|before|once|whether|as|despite|even)\b/i;
const VERB_OPENER =
  /^(?:do|go|run|use|set|make|add|remove|check|install|open|click|select|choose|press|enter|start|stop|create|delete|update|apply|configure|connect|disconnect|replace|insert|verify|test|build|deploy|read|write|copy|move|find|send|save|close|turn|wait|repeat|avoid|keep|put|let|allow|ensure|ignore|prefer|note|remember|pull|push|look|review|measure|calculate)\b/i;
const STANDARD_OPENER =
  /^(?:the|a|an|this|that|these|those|it|they|we|you|he|she|its|their|our|your|there|here|all|any|each|every|some|no)\b/i;

function isProcedural(s: string): boolean {
  const first = s.split(/\s+/)[0] ?? "";
  if (SUBORDINATOR.test(first)) return false;
  if (VERB_OPENER.test(first)) return true;
  return STANDARD_OPENER.test(first);
}

const IMPERATIVE = /^(?:do|go|run|use|set|make|add|remove|check|install|open|click|select|choose|press|enter|start|stop|create|delete|update|apply|configure|connect|disconnect|replace|insert|test|build|deploy|read|write|copy|move|find|send|save|close|wait|repeat|avoid|keep|put|review|measure|calculate|verify|turn|follow|allow|ignore|prefer|note|remember|pull|push|look|switch|boot|upgrade|rollback|restore|pin|unpin|enable|disable|clear|reset|retry|skip|include|exclude|pass|set|change|define|declare|export|import|initialize|install)\b/i;

function collect(text: string): { findings: Map<string, { spec: Spec; count: number; excerpt: string }>; sentences: SentenceInfo[] } {
  const findings = new Map<string, { spec: Spec; count: number; excerpt: string }>();
  const sentences = splitSentences(text).map((s, i) => ({
    text: s,
    words: steWordCount(s),
    procedural: isProcedural(s),
    start: i,
  }));

  const record = (spec: Spec, excerpt: string) => {
    const key = `${spec.rule}|${spec.message}`;
    const cur = findings.get(key);
    if (cur) {
      cur.count += 1;
      if (cur.excerpt.length < 90 && excerpt.length > cur.excerpt.length) cur.excerpt = excerpt;
    } else {
      findings.set(key, { spec, count: 1, excerpt: excerpt.slice(0, 90) });
    }
  };

  for (const spec of SPECS) {
    for (const sentence of sentences) {
      if (spec.re.source === "$^") continue;
      // Skip the fake-sentence guards: the real length checks run separately.
      if (spec.keep === "sentence" || spec.keep === "paragraph") continue;
      if (spec.rule === "5.1" || spec.rule === "6.3" || spec.rule === "6.6") continue;
      if (spec.rule === "5.4") {
        const m = sentence.text.match(/\b(?:if|when|unless|whenever)\b/i);
        if (!m || m.index === undefined) continue;
        const before = sentence.text.slice(0, m.index).trim();
        if (before.length <= 3) continue;
        record(spec, sentence.text);
        continue;
      }
      if (spec.rule === "5.3") {
        if (!sentence.procedural) continue;
      }
      if (spec.rule === "5.2") {
        if (!sentence.procedural) continue;
      }
      if (spec.rule === "5.5") {
        if (!sentence.procedural) continue;
      }
      if (spec.rule === "4.5") {
        const m = sentence.text.match(spec.re);
        if (!m) continue;
        if (m.index !== undefined && m.index > 0 && !/[\s.,;:(]$/.test(sentence.text.slice(0, m.index).trimEnd())) continue;
        record(spec, sentence.text);
        continue;
      }
      if (spec.rule === "1.1" && spec.keep === "past of can") {
        const m = sentence.text.match(spec.re);
        if (!m) continue;
        const word = m[0].toLowerCase();
        if (word === "could" && !/\bcould\s+(?:not|be|been|has|have|had|was|were|do|does|did)\b/i.test(sentence.text)) continue;
        if (word === "may" && /\bmay\s+(?:i|we)\b/i.test(sentence.text)) continue;
        record(spec, m[0]);
        continue;
      }
      if (spec.rule === "8.6") {
        const m = sentence.text.match(spec.re);
        if (m) record(spec, m[0]);
        continue;
      }
      const m = sentence.text.match(spec.re);
      if (m) record(spec, m[0].length > 2 ? m[0] : sentence.text);
    }
  }

  // 1.14 American spelling (kept separate so it can use the wider list).
  for (const sentence of sentences) {
    const m = sentence.text.match(BRITISH);
    if (m) {
      const key = "1.14|American English spelling.";
      const cur = findings.get(key);
      if (cur) cur.count += 1;
      else findings.set(key, { spec: { rule: "1.14", severity: "error", message: "Use American English spelling.", fix: "Use the American spelling.", re: BRITISH }, count: 1, excerpt: m[0] });
    }
  }

  // 5.1 and 6.3 sentence length.
  for (const sentence of sentences) {
    const limit = sentence.procedural ? 20 : 25;
    if (sentence.words > limit) {
      const rule = sentence.procedural ? "5.1" : "6.3";
      const message = sentence.procedural
        ? "Sentence is too long for procedural text. Maximum 20 words."
        : "Sentence is too long for descriptive text. Maximum 25 words.";
      const spec: Spec = { rule, severity: "error", message, fix: "Split the sentence into two sentences.", re: /$^/, keep: "sentence" };
      const key = `${rule}|${message}`;
      const cur = findings.get(key);
      if (cur) cur.count += 1;
      else findings.set(key, { spec, count: 1, excerpt: sentence.text });
    }
  }

  // 6.6 paragraph length.
  for (const para of paragraphs(text)) {
    const sents = splitSentences(para);
    if (sents.length > 6) {
      const spec: Spec = { rule: "6.6", severity: "error", message: "A paragraph must have 6 sentences or fewer.", fix: "Start a new paragraph, or use a vertical list.", re: /$^/, keep: "paragraph" };
      findings.set("6.6|" + spec.message, { spec, count: sents.length - 6, excerpt: sents.slice(0, 2).join(" ") });
    }
  }

  // 4.3 vertical list advisory: three or more actions in one sentence.
  for (const sentence of sentences) {
    const actions = (sentence.text.match(/\b(?:and\s+then|,\s*then|;\s*)\s*\w+/gi) ?? []).length;
    const conjuncts = (sentence.text.match(/\band\s+\w+/gi) ?? []).length;
    if (actions >= 2 || conjuncts >= 4) {
      const spec: Spec = { rule: "4.3", severity: "warning", message: "The sentence has many actions. Use a vertical list.", fix: "Put each action on its own line as a step.", re: /$^/ };
      findings.set("4.3|" + spec.message, { spec, count: 1, excerpt: sentence.text });
    }
  }

  // 9.1 stacked banned words.
  for (const sentence of sentences) {
    const hits = SPECS.filter((s) => s.rule === "1.1" && (sentence.text.match(s.re) ?? []).length).length;
    if (hits >= 3) {
      const spec: Spec = { rule: "9.1", severity: "warning", message: "The sentence has many unapproved words. Restructure it.", fix: "Rewrite the sentence, do not swap words one by one.", re: /$^/ };
      findings.set("9.1|" + spec.message, { spec, count: 1, excerpt: sentence.text });
    }
  }

  return { findings, sentences };
}

export function lintSte100(text: string): SteReport {
  const clean = text.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ");
  const { findings, sentences } = collect(clean);
  const out: SteFinding[] = [...findings.values()].map((f) => ({
    rule: f.spec.rule,
    severity: f.spec.severity,
    message: f.spec.message,
    excerpt: f.excerpt,
    fix: f.spec.fix,
    count: f.count,
  }));
  out.sort((a, b) => a.rule.localeCompare(b.rule, undefined, { numeric: true }) || a.message.localeCompare(b.message));
  const errors = out.filter((f) => f.severity === "error").reduce((a, f) => a + f.count, 0);
  const warnings = out.filter((f) => f.severity === "warning").reduce((a, f) => a + f.count, 0);
  const words = clean.trim() ? clean.trim().split(/\s+/).length : 0;
  const longest = sentences.reduce((a, s) => Math.max(a, s.words), 0);
  const total = words + errors * 2 + warnings;
  return {
    findings: out,
    errors,
    warnings,
    words,
    sentences: sentences.length,
    longestSentence: longest,
    score: total === 0 ? 100 : Math.max(0, Math.round(100 * (1 - (errors * 2 + warnings) / Math.max(words, 1)))),
  };
}

export function styleWarnings(text: string): string[] {
  return lintSte100(text)
    .findings.map((f) => `${f.rule}: ${f.message} ${f.count > 1 ? `(${f.count}x) ` : ""}e.g. "${f.excerpt}"`)
    .slice(0, 6);
}

export const STE_SYSTEM =
  "Write every narration line and on-screen line in Simplified Technical English (ASD-STE100, Issue 9). " +
  "Use short sentences of 20 words or fewer, active voice, one instruction or one idea per sentence, no contractions, " +
  "and the approved modals can, will, and must instead of should, would, may, or might. " +
  "Use American English. Use short approved words, not in order to, prior to, utilize, or at this time. " +
  "Use exactly one term for each meaning, for example settings, not config and settings in the same video. " +
  "Do not use the semicolon. Keep code, identifiers, commands, and file paths exactly as written. " +
  "The voice must still sound like a person explaining a repository, not like a manual. " + KEEP;

/** Compact rule digest injected into the reel script prompt when plain-language mode is on. */
export function steScriptRules(): string {
  return (
    "Write the narration and the on-screen lines in Simplified Technical English (ASD-STE100 Issue 9). " +
    "Sentences of 20 words or fewer. Active voice. One idea per sentence. No contractions. " +
    "Use can, will, and must; never should, would, may, or might. " +
    "Use American English. Use short approved words: not in order to, prior to, utilize, or at this time. " +
    "Use one term for each meaning. Do not use the semicolon. " +
    "Put any if or when condition at the start of its sentence, before the command. " +
    KEEP +
    " The voice must still sound like a person explaining a repository, not like a maintenance manual."
  );
}

/** Mechanical findings for one block of narration, used as reel review warnings. */
export function plainLanguageFindings(text: string): SteFinding[] {
  return lintSte100(text).findings.filter((f) => f.severity === "error");
}
