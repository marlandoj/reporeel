export type Caption = { scene: number; start: number; end: number; text: string };

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?;:])\s+/)
    .filter(Boolean);
}

export function chunkNarration(narration: string, maxChars: number): string[] {
  const chunks: string[] = [];
  for (const sentence of splitSentences(narration)) {
    const words = sentence.split(" ");
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (next.length > maxChars && cur) {
        chunks.push(cur);
        cur = w;
      } else {
        cur = next;
      }
    }
    if (cur) chunks.push(cur);
  }
  const merged: string[] = [];
  for (const c of chunks) {
    const last = merged[merged.length - 1];
    if (last && last.length + c.length + 1 <= maxChars * 0.6) merged[merged.length - 1] = `${last} ${c}`;
    else merged.push(c);
  }
  return merged;
}

export function buildCaptions(
  narrations: string[],
  audioStarts: number[],
  audioSeconds: number[],
  maxChars: number
): Caption[] {
  const out: Caption[] = [];
  narrations.forEach((n, i) => {
    const chunks = chunkNarration(n, maxChars);
    const totalChars = chunks.reduce((a, c) => a + c.length, 0) || 1;
    const secs = audioSeconds[i] ?? 0;
    const base = audioStarts[i] ?? 0;
    let cum = 0;
    chunks.forEach((text, k) => {
      const start = base + (secs * cum) / totalChars;
      cum += text.length;
      const rawEnd = base + (secs * cum) / totalChars;
      const end = k === chunks.length - 1 ? rawEnd + 0.25 : rawEnd;
      out.push({ scene: i, start: round2(start), end: round2(Math.max(start + 0.4, end)), text });
    });
  });
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function srtTime(t: number): string {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n: number, w: number) => String(n).padStart(w, "0");
  return `${p(h, 2)}:${p(m, 2)}:${p(s, 2)},${p(r, 3)}`;
}

export function toSrt(caps: Caption[]): string {
  return caps
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`)
    .join("\n");
}
