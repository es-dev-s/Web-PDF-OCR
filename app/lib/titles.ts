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

function looksLikeFilename(value: string): boolean {
  return value.toLowerCase().endsWith(".pdf");
}

export function isPrintedTitle(value: string | null | undefined): boolean {
  const title = (value || "").trim();
  if (!title) return false;
  if (looksLikeFilename(title)) return false;
  if (title === UNTITLED_DOCUMENT) return false;
  if (title === UNREADABLE_TITLE) return false;
  return true;
}

export function displayTitle(value: string | null | undefined): string {
  const title = (value || "").trim();
  if (!title || looksLikeFilename(title)) return UNTITLED_DOCUMENT;
  return title;
}

export function documentName(data: TitleSuggestion): string {
  const title = (data.title || "").trim();
  if (isPrintedTitle(title)) return title;
  if (title === UNREADABLE_TITLE) return UNREADABLE_TITLE;
  if (data.ok === false && data.message === "No OCR") {
    return UNREADABLE_TITLE;
  }
  return UNTITLED_DOCUMENT;
}

export function storedTitle(value: string | null | undefined): string {
  const title = (value || "").trim();
  if (isPrintedTitle(title) || title === UNREADABLE_TITLE) return title;
  return "";
}
