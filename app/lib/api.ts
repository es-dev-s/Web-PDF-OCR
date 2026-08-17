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
  source_id?: string
  document_id?: string
  title: string
  erp: string
  client?: string
  member?: string
  score: number
  uploaded_at: string
  file_url?: string
  content_type?: string
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
  review_note?: string
  review_requested_at?: string
};

export type ApiNotification = {
  id: string
  title: string
  detail: string
  read: boolean
  created_at: string
  kind?: string
  audience?: string
  document_id?: string
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(response: Response, fallback: number) {
  const raw = response.headers.get("Retry-After");
  if (!raw) return fallback;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, 15_000);
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let delay = 1000;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const headers = new Headers(init?.headers);
    const response = await fetch(url(path), {
      cache: "no-store",
      credentials: "include",
      ...init,
      headers,
    });
    if (response.status === 401 && path !== "/v1/auth/login" && path !== "/v1/auth/me") {
      const { onUnauthorized } = await import("@/app/store/user-store");
      onUnauthorized();
    }
    if (response.status === 503) {
      const error = await parseError(response);
      if (error.code === "busy" && attempt < 4) {
        await sleep(retryAfterMs(response, delay));
        delay = Math.min(delay * 2, 8000);
        continue;
      }
      throw error;
    }
    if (!response.ok) {
      throw await parseError(response);
    }
    return (await response.json()) as T;
  }
  throw new ApiError(503, "busy", "server is busy; retry shortly");
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

export type UploadDay = {
  day: string
  documents: number
  sources: number
};

export type UploadStats = {
  bucket: string
  timezone: string
  from: string
  to: string
  days: UploadDay[]
  total: { documents: number; sources: number }
};

export function uploadStats(from?: string, to?: string) {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const suffix = query.toString() ? `?${query}` : "";
  return request<UploadStats>(`/v1/stats/uploads${suffix}`);
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

export type AuthRole = "admin" | "member";

export type ApiUser = {
  id: string
  email: string
  name: string
  role: AuthRole
  disabled?: boolean
  created_at?: string
};

export function login(email: string, password: string) {
  return request<{ user: ApiUser }>("/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return request<{ ok: boolean }>("/v1/auth/logout", { method: "POST" });
}

export function currentUser() {
  return request<{ user: ApiUser }>("/v1/auth/me");
}

export function listUsers() {
  return request<{ items: ApiUser[] }>("/v1/users");
}

export function createUser(input: {
  name: string
  email: string
  password: string
  role: AuthRole
}) {
  return request<{ user: ApiUser }>("/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function setUserDisabled(id: string, disabled: boolean) {
  return request<{ ok: boolean }>(`/v1/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disabled }),
  });
}

export function listReviews() {
  return request<{ items: ApiDocument[] }>("/v1/reviews");
}

export function approveReview(id: string) {
  return request<ApiDocument>(`/v1/reviews/${id}/approve`, { method: "POST" });
}

export function rejectReview(id: string) {
  return request<{ ok: boolean }>(`/v1/reviews/${id}/reject`, { method: "POST" });
}

export function eventsUrl() {
  return url("/v1/events/stream");
}

export type TitleSuggestion = {
  ok: boolean
  title?: string | null
  message?: string | null
  filename?: string | null
  title_source?: string | null
  method?: string | null
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

function combineSignals(signal?: AbortSignal, timeout?: AbortSignal): AbortSignal | undefined {
  if (!signal) return timeout;
  if (!timeout) return signal;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([signal, timeout]);
  }
  const ac = new AbortController();
  const abort = () => ac.abort();
  if (signal.aborted || timeout.aborted) {
    ac.abort();
    return ac.signal;
  }
  signal.addEventListener("abort", abort, { once: true });
  timeout.addEventListener("abort", abort, { once: true });
  return ac.signal;
}

async function postFile<T>(
  path: string,
  file: File,
  signal?: AbortSignal,
): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  let delay = 1000;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const timeout = AbortSignal.timeout(120_000);
    const combined = combineSignals(signal, timeout);
    const response = await fetch(url(path), {
      method: "POST",
      body: form,
      cache: "no-store",
      credentials: "include",
      signal: combined,
    });
    if (response.status === 503) {
      const error = await parseError(response);
      if (error.code === "busy" && attempt < 4 && !signal?.aborted) {
        await sleep(retryAfterMs(response, delay));
        delay = Math.min(delay * 2, 8000);
        continue;
      }
      throw error;
    }
    if (!response.ok) {
      throw await parseError(response);
    }
    return (await response.json()) as T;
  }
  throw new ApiError(503, "busy", "server is busy; retry shortly");
}

export async function inspectFile(file: File, signal?: AbortSignal): Promise<InspectResult> {
  const data = await postFile<InspectResult>("/v1/documents/inspect", file, signal);
  const ok = data.ok !== false;
  const matches = ok ? data.matches ?? [] : [];
  return {
    ok,
    uniqueness: ok && data.uniqueness === "duplicate" && matches.length > 0 ? "duplicate" : "unique",
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
      let last: InspectResult = emptyInspect();
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          last = await inspectFile(files[index], signal);
          if (last.ok) break;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            throw error;
          }
          last = emptyInspect();
        }
      }
      out[index] = last;
    }
  };
  await Promise.all([worker(), worker()]);
  return out;
}
