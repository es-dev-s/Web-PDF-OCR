export type TitleSuggestion = {
  ok?: boolean
  title?: string | null
  message?: string | null
  filename?: string | null
  title_source?: string | null
  method?: string | null
};

export const UNTITLED_DOCUMENT = "Untitled document";
export const UNREADABLE_TITLE = "Title not readable (scanned PDF)";

function stripPdfExt(value: string): string {
  const title = value.trim();
  if (title.length >= 4 && title.slice(-4).toLowerCase() === ".pdf") {
    return title.slice(0, -4).trim();
  }
  return title;
}

function looksLikeFilename(value: string): boolean {
  const title = stripPdfExt(value);
  if (!title) return true;
  return !title.includes(" ");
}

export function isPrintedTitle(value: string | null | undefined): boolean {
  const title = stripPdfExt(value || "");
  if (!title) return false;
  if (looksLikeFilename(title)) return false;
  if (title === UNTITLED_DOCUMENT) return false;
  if (title === UNREADABLE_TITLE) return false;
  return true;
}

export function displayTitle(value: string | null | undefined): string {
  const raw = (value || "").trim();
  if (raw === UNREADABLE_TITLE) return UNREADABLE_TITLE;
  const title = stripPdfExt(raw);
  if (!title || looksLikeFilename(title)) return UNTITLED_DOCUMENT;
  return title;
}

export function documentName(data: TitleSuggestion): string {
  const title = stripPdfExt(data.title || "");
  if (isPrintedTitle(title)) return title;
  if (title === UNREADABLE_TITLE) return UNREADABLE_TITLE;
  if (data.ok === false && data.message === "No OCR") {
    return UNREADABLE_TITLE;
  }
  return UNTITLED_DOCUMENT;
}

export function storedTitle(value: string | null | undefined): string {
  const title = (value || "").trim();
  if (title === UNREADABLE_TITLE) return title;
  if (isPrintedTitle(title)) return displayTitle(title);
  return "";
}

export function isTitlePending(
  title: string | null | undefined,
  needsTitle?: boolean,
): boolean {
  const value = (title || "").trim();
  if (value === UNREADABLE_TITLE || isPrintedTitle(value)) return false;
  if (needsTitle) return true;
  if (!value) return true;
  return looksLikeFilename(value) || value === UNTITLED_DOCUMENT;
}

export function similarPercent(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  const pct = score > 1 ? score : score * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

const TITLE_STOP = new Set([
  "a", "an", "and", "as", "at", "by", "for", "from", "in", "into",
  "of", "on", "over", "per", "the", "to", "using", "via", "with",
]);

const WORD_MIN = 0.85;

export type TitlePart = {
  text: string
  hit: boolean
};

function foldWord(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function wordRunes(value: string): string[] {
  return Array.from(value);
}

function levenshtein(a: string, b: string): number {
  const left = wordRunes(a);
  const right = wordRunes(b);
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;
  let prev = Array.from({ length: right.length + 1 }, (_, i) => i);
  let cur = Array.from({ length: right.length + 1 }, () => 0);
  for (let i = 1; i <= left.length; i += 1) {
    cur[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  return prev[right.length];
}

function wordScore(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 4 || b.length < 4) return 0;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

export function titleContentWords(value: string): string[] {
  return displayTitle(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !TITLE_STOP.has(part));
}

export function alignedTitleWords(original: string, similar: string) {
  const left = titleContentWords(original);
  const right = titleContentWords(similar);
  const leftHit = left.map(() => false);
  const rightHit = right.map(() => false);
  let matched = 0;
  for (let i = 0; i < left.length; i += 1) {
    let best = -1;
    let bestScore = 0;
    for (let j = 0; j < right.length; j += 1) {
      if (rightHit[j]) continue;
      const score = wordScore(left[i], right[j]);
      if (score >= WORD_MIN && score > bestScore) {
        bestScore = score;
        best = j;
      }
    }
    if (best >= 0) {
      leftHit[i] = true;
      rightHit[best] = true;
      matched += 1;
    }
  }
  const total = Math.max(left.length, right.length);
  return { matched, total, leftHit, rightHit, left, right };
}

function highlightWords(title: string, hits: Set<string>): TitlePart[] {
  const heading = displayTitle(title);
  if (!heading) return [];
  const parts: TitlePart[] = [];
  const pattern = /[A-Za-z0-9]+|[^A-Za-z0-9]+/g;
  let piece = pattern.exec(heading);
  while (piece) {
    const text = piece[0];
    const folded = foldWord(text);
    const word = folded.length > 0 && /[A-Za-z0-9]/.test(text);
    const hit = word && !TITLE_STOP.has(folded) && hits.has(folded);
    const last = parts[parts.length - 1];
    if (last && last.hit === hit) last.text += text;
    else parts.push({ text, hit });
    piece = pattern.exec(heading);
  }
  return parts;
}

export function similarTitleParts(original: string, similar: string): TitlePart[] {
  const aligned = alignedTitleWords(original, similar);
  const hits = new Set(
    aligned.right.filter((_, index) => aligned.rightHit[index]),
  );
  return highlightWords(similar, hits);
}
