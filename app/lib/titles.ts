export type TitleSuggestion = {
  ok?: boolean
  title?: string | null
  message?: string | null
  filename?: string | null
  title_source?: string | null
  method?: string | null
};

export function isPrintedTitle(value: string | null | undefined): boolean {
  const title = (value || "").trim();
  if (!title) return false;
  if (title.toLowerCase().endsWith(".pdf")) return false;
  if (title === "Untitled document") return false;
  if (title === "Title not readable (scanned PDF)") return false;
  return true;
}

export function documentName(data: TitleSuggestion): string {
  const title = (data.title || "").trim();
  if (isPrintedTitle(title)) return title;
  if (data.ok === false && data.message === "No OCR") {
    return "Title not readable (scanned PDF)";
  }
  return "Untitled document";
}
