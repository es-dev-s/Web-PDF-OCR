import { SAME_ORIGIN_BACKEND } from "@/app/lib/backend";
import type { DocumentStatus, SourceUniqueness } from "@/app/lib/files";

export class ApiError extends Error {
  code: string
  status: number

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type ApiDuplicate = {
  id: string
  title: string
  erp: string
  client?: string
  member?: string
  score: number
  uploaded_at: string
  kind?: string
  uniqueness?: SourceUniqueness
};

export type ApiSource = {
  id: string
  title: string
  uploaded_at: string
  score: number | null
  uniqueness: SourceUniqueness
  content_type?: string
  size_bytes?: number
  file_url: string
  duplicates: ApiDuplicate[]
};

export type ApiDocument = {
  id: string
  title: string
  uploader: string
  client: string
  erp: string
  anzsco: string
  team: string
  member: string
  status: DocumentStatus
  uploaded_at: string
  url: string
  file_url: string
  sources: ApiSource[]
};

export type ApiNotification = {
  id: string
  title: string
  detail: string
  read: boolean
  created_at: string
};

export type LiveEvent = {
  origin?: string
  type: string
  at?: string
  data?: unknown
};

function url(path: string) {
  return `${SAME_ORIGIN_BACKEND}${path}`;
}

async function parseError(response: Response): Promise<ApiError> {
  let code = "error";
  let message = `request ${response.status}`;
  try {
    const body = (await response.json()) as { code?: string; error?: string };
    if (body.code) code = body.code;
    if (body.error) message = body.error;
  } catch {
    // Keep defaults.
  }
  return new ApiError(response.status, code, message);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url(path), {
    cache: "no-store",
    ...init,
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as T;
}

export function listDocuments() {
  return request<{ items: ApiDocument[] }>("/v1/documents");
}

export function nextErp() {
  return request<{ erp: string }>("/v1/documents/next-erp");
}

export function createDocument(form: FormData) {
  return request<ApiDocument>("/v1/documents", {
    method: "POST",
    body: form,
  });
}

export function addSources(id: string, form: FormData) {
  return request<ApiDocument>(`/v1/documents/${id}/sources`, {
    method: "POST",
    body: form,
  });
}

export function deleteDocument(id: string) {
  return request<{ ok: boolean }>(`/v1/documents/${id}`, {
    method: "DELETE",
  });
}

export function listNotifications() {
  return request<{ items: ApiNotification[] }>("/v1/notifications");
}

export function markNotificationRead(id: string) {
  return request<ApiNotification>(`/v1/notifications/${id}/read`, {
    method: "PATCH",
  });
}

export function markAllNotificationsRead() {
  return request<{ ok: boolean }>("/v1/notifications/read-all", {
    method: "POST",
  });
}

export function eventsUrl() {
  return url("/v1/events/stream");
}

export type TitleSuggestion = {
  ok: boolean
  title?: string
  title_source?: string
  filename?: string
};

export async function suggestTitle(file: File, signal?: AbortSignal): Promise<TitleSuggestion> {
  return postFile<TitleSuggestion>("/v1/engine/title", file, signal);
}

export type InspectMatch = {
  id: string
  title: string
  erp: string
  client?: string
  member?: string
  score: number
  uploaded_at: string
  uniqueness?: SourceUniqueness
  kind?: string
};

export type InspectResult = {
  ok: boolean
  uniqueness: "unique" | "duplicate"
  filename?: string
  digest?: string
  matches: InspectMatch[]
};

function emptyInspect(): InspectResult {
  return { ok: false, uniqueness: "unique", matches: [] };
}

async function postFile<T>(
  path: string,
  file: File,
  signal?: AbortSignal,
): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const timeout = AbortSignal.timeout(120_000);
  const combined =
    signal && "any" in AbortSignal
      ? AbortSignal.any([signal, timeout])
      : timeout;
  const response = await fetch(url(path), {
    method: "POST",
    body: form,
    cache: "no-store",
    signal: combined,
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as T;
}

function isConfidentMatch(match: InspectMatch): boolean {
  const score = match.score ?? 0;
  if (match.kind === "exact" || score >= 99) return true;
  if (match.kind === "visual") return score >= 95;
  return score >= 96.5;
}

export async function inspectFile(file: File, signal?: AbortSignal): Promise<InspectResult> {
  const data = await postFile<InspectResult>("/v1/documents/inspect", file, signal);
  const matches = (data.ok === false ? [] : data.matches ?? []).filter(isConfidentMatch);
  return {
    ok: data.ok !== false,
    uniqueness: matches.length > 0 ? "duplicate" : "unique",
    filename: data.filename,
    digest: data.digest,
    matches,
  };
}

export async function inspectFiles(
  files: File[],
  signal?: AbortSignal,
): Promise<InspectResult[]> {
  const out: InspectResult[] = Array.from({ length: files.length }, emptyInspect);
  let cursor = 0;
  const worker = async () => {
    while (cursor < files.length) {
      const index = cursor;
      cursor += 1;
      try {
        out[index] = await inspectFile(files[index], signal);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
        out[index] = emptyInspect();
      }
    }
  };
  await Promise.all([worker(), worker()]);
  return out;
}
