import { create } from "zustand";
import {
  ApiError,
  addSources as apiAddSources,
  createDocument,
  deleteDocument,
  inspectFiles,
  listDocuments,
  nextErp as fetchNextErp,
  type ApiDocument,
  type ApiSource,
  type InspectResult,
} from "@/app/lib/api";
import { formatDate, formatDateTime } from "@/app/lib/dates";
import { SOURCE_TOTAL, parseDocumentStatus, parseUniqueness, type DocumentStatus, type SourceUniqueness } from "@/app/lib/files";
import { useUserStore } from "@/app/store/user-store";

export type DuplicateMatch = {
  id: string
  title: string
  erp: string
  client?: string
  member?: string
  score: number
  uploaded: string
  uniqueness: SourceUniqueness
};

export type SourceFile = {
  id: string
  title: string
  uploaded: string
  score: number | null
  uniqueness: SourceUniqueness
  contentType?: string
  sizeBytes?: number
  duplicates: DuplicateMatch[]
  fileUrl?: string
};

export type DocumentItem = {
  id: string
  title: string
  uploader: string
  client: string
  erp: string
  anzsco: string
  team: string
  member: string
  status: DocumentStatus
  uploaded: string
  uploadedAt: string
  url: string
  fileUrl?: string
  sources: SourceFile[]
};

export type NewDocumentInput = {
  client: string
  erp: string
  anzsco: string
  team: string
  member: string
  files: File[]
  titles?: string[]
};

export type PendingSourceAdd = {
  docId: string
  files: File[]
  results: InspectResult[]
};

type DocumentsState = {
  query: string
  items: DocumentItem[]
  visibleItems: DocumentItem[]
  expandedId: string | null
  inspect: Record<string, true>
  compareByDoc: Record<string, string[]>
  pendingDeleteId: string | null
  pendingViewId: string | null
  pendingSourceAdd: PendingSourceAdd | null
  addingToId: string | null
  setQuery: (query: string) => void
  toggleExpanded: (id: string) => void
  toggleInspect: (docId: string, sourceId: string) => void
  toggleCompare: (docId: string, sourceId: string) => void
  replaceAll: (items: DocumentItem[]) => void
  upsert: (item: DocumentItem) => void
  dropLocal: (id: string) => void
  refresh: () => Promise<void>
  addDocument: (input: NewDocumentInput) => Promise<"ok" | "erp" | "files" | "error">
  addSources: (id: string, files: File[]) => Promise<void>
  beginAddSources: (id: string, files: File[]) => Promise<void>
  confirmPendingAdd: () => Promise<void>
  cancelPendingAdd: () => void
  openView: (id: string) => void
  closeView: () => void
  askRemove: (id: string) => void
  cancelRemove: () => void
  confirmRemove: () => Promise<void>
};

const EMPTY: DocumentItem[] = [];
let refreshLock = false;
const inFlightDeletes = new Map<string, DocumentItem>();

function matchesQuery(item: DocumentItem, query: string): boolean {
  if (!query) return true;
  if (
    item.title.toLowerCase().includes(query) ||
    item.uploader.toLowerCase().includes(query) ||
    item.erp.toLowerCase().includes(query) ||
    item.client.toLowerCase().includes(query) ||
    item.anzsco.toLowerCase().includes(query) ||
    item.team.toLowerCase().includes(query) ||
    item.member.toLowerCase().includes(query)
  ) {
    return true;
  }
  return item.sources.some((source) => source.title.toLowerCase().includes(query));
}

function filterItems(items: DocumentItem[], query: string): DocumentItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => matchesQuery(item, q));
}

export function inspectKey(docId: string, sourceId: string) {
  return `${docId}::${sourceId}`;
}

function omitPrefixed(
  record: Record<string, true>,
  prefix: string,
): Record<string, true> | null {
  let next: Record<string, true> | null = null;
  for (const key of Object.keys(record)) {
    if (!key.startsWith(prefix)) continue;
    if (!next) next = { ...record };
    delete next[key];
  }
  return next;
}

function nextErpCode(items: DocumentItem[]): string {
  const used = new Set(items.map((item) => item.erp.toLowerCase()));
  let n = 10001;
  let code = `ERP-${n}`;
  while (used.has(code.toLowerCase())) {
    n += 1;
    code = `ERP-${n}`;
  }
  return code;
}

function mapSource(source: ApiSource): SourceFile {
  return {
    id: source.id,
    title: source.title,
    uploaded: formatDateTime(source.uploaded_at),
    score: source.score,
    uniqueness: parseUniqueness(source.uniqueness),
    contentType: source.content_type,
    sizeBytes: source.size_bytes,
    fileUrl: source.file_url,
    duplicates: (source.duplicates ?? []).map((match) => ({
      id: match.id,
      title: match.title,
      erp: match.erp,
      client: match.client,
      member: match.member,
      score: match.score,
      uploaded: formatDateTime(match.uploaded_at),
      uniqueness: parseUniqueness(match.uniqueness),
    })),
  };
}

export function mapDocument(raw: ApiDocument): DocumentItem {
  const sources = (raw.sources ?? []).map(mapSource);
  return {
    id: raw.id,
    title: raw.title,
    uploader: raw.uploader || raw.member,
    client: raw.client,
    erp: raw.erp,
    anzsco: raw.anzsco,
    team: raw.team,
    member: raw.member,
    status: parseDocumentStatus(raw.status),
    uploaded: formatDate(raw.uploaded_at),
    uploadedAt: raw.uploaded_at,
    url: raw.url,
    fileUrl: raw.file_url,
    sources,
  };
}

function appendFiles(form: FormData, files: File[], titles?: string[]) {
  for (let i = 0; i < files.length; i += 1) {
    form.append("files", files[i]);
    form.append("titles", titles?.[i] ?? "");
  }
}

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  query: "",
  items: EMPTY,
  visibleItems: EMPTY,
  expandedId: null,
  inspect: {},
  compareByDoc: {},
  pendingDeleteId: null,
  pendingViewId: null,
  pendingSourceAdd: null,
  addingToId: null,
  setQuery: (query) => {
    if (get().query === query) return;
    set((state) => ({
      query,
      visibleItems: filterItems(state.items, query),
    }));
  },
  toggleExpanded: (id) => {
    set((state) => {
      if (state.expandedId === id) {
        const inspect = omitPrefixed(state.inspect, `${id}::`);
        return inspect
          ? { expandedId: null, inspect }
          : { expandedId: null };
      }
      const prev = state.expandedId;
      const inspect = prev
        ? omitPrefixed(state.inspect, `${prev}::`)
        : null;
      if (inspect) return { expandedId: id, inspect };
      return { expandedId: id };
    });
  },
  toggleInspect: (docId, sourceId) => {
    const key = inspectKey(docId, sourceId);
    set((state) => {
      if (state.inspect[key]) {
        const inspect = { ...state.inspect };
        delete inspect[key];
        return { inspect };
      }
      return { inspect: { ...state.inspect, [key]: true } };
    });
  },
  toggleCompare: (docId, sourceId) => {
    set((state) => {
      const current = state.compareByDoc[docId] ?? [];
      const exists = current.includes(sourceId);
      const next = exists
        ? current.filter((id) => id !== sourceId)
        : [...current, sourceId].slice(-2);
      if (
        next.length === current.length &&
        next.every((id, index) => id === current[index])
      ) {
        return state;
      }
      if (next.length === 0) {
        if (!(docId in state.compareByDoc)) return state;
        const rest = { ...state.compareByDoc };
        delete rest[docId];
        return { compareByDoc: rest };
      }
      return {
        compareByDoc: { ...state.compareByDoc, [docId]: next },
      };
    });
  },
  replaceAll: (items) => {
    set((state) => {
      const kept =
        inFlightDeletes.size === 0
          ? items
          : items.filter((item) => !inFlightDeletes.has(item.id));
      const next = kept.length === 0 ? EMPTY : kept;
      const expandedId =
        state.expandedId && next.some((item) => item.id === state.expandedId)
          ? state.expandedId
          : null;
      const pendingDeleteId =
        state.pendingDeleteId &&
        next.some((item) => item.id === state.pendingDeleteId)
          ? state.pendingDeleteId
          : null;
      const pendingViewId =
        state.pendingViewId &&
        next.some((item) => item.id === state.pendingViewId)
          ? state.pendingViewId
          : null;
      return {
        items: next,
        visibleItems: filterItems(next, state.query),
        expandedId,
        pendingDeleteId,
        pendingViewId,
      };
    });
  },
  upsert: (item) => {
    if (inFlightDeletes.has(item.id)) return;
    set((state) => {
      const index = state.items.findIndex((current) => current.id === item.id);
      const items =
        index === -1
          ? [item, ...state.items]
          : state.items.map((current) =>
              current.id === item.id ? item : current,
            );
      return {
        items,
        visibleItems: filterItems(items, state.query),
      };
    });
  },
  dropLocal: (id) => {
    set((state) => {
      if (!state.items.some((item) => item.id === id)) return state;
      const items = state.items.filter((item) => item.id !== id);
      const compareByDoc = { ...state.compareByDoc };
      delete compareByDoc[id];
      const inspect = omitPrefixed(state.inspect, `${id}::`) ?? state.inspect;
      return {
        items: items.length === 0 ? EMPTY : items,
        visibleItems: filterItems(items.length === 0 ? EMPTY : items, state.query),
        expandedId: state.expandedId === id ? null : state.expandedId,
        pendingDeleteId:
          state.pendingDeleteId === id ? null : state.pendingDeleteId,
        pendingViewId: state.pendingViewId === id ? null : state.pendingViewId,
        pendingSourceAdd:
          state.pendingSourceAdd?.docId === id ? null : state.pendingSourceAdd,
        inspect,
        compareByDoc,
      };
    });
  },
  refresh: async () => {
    if (refreshLock) return;
    refreshLock = true;
    try {
      const { items } = await listDocuments();
      get().replaceAll(items.map(mapDocument));
    } catch {
      // Connection status is owned by the backend heartbeat.
    } finally {
      refreshLock = false;
    }
  },
  addDocument: async (input) => {
    const files = input.files.slice(0, SOURCE_TOTAL);
    if (files.length === 0) return "files";
    const erp = input.erp.trim();
    if (!erp) return "erp";
    const taken = get().items.some(
      (item) => item.erp.toLowerCase() === erp.toLowerCase(),
    );
    if (taken) return "erp";
    const member =
      input.member.trim() || useUserStore.getState().name || "User";
    const form = new FormData();
    form.set("client", input.client.trim());
    form.set("erp", erp);
    form.set("anzsco", input.anzsco.trim());
    form.set("team", input.team.trim());
    form.set("member", member);
    appendFiles(form, files, input.titles);
    try {
      const doc = await createDocument(form);
      get().upsert(mapDocument(doc));
      return "ok";
    } catch (error) {
      if (error instanceof ApiError && error.code === "erp_taken") {
        return "erp";
      }
      return "error";
    }
  },
  addSources: async (id, files) => {
    if (files.length === 0) return;
    const current = get().items.find((item) => item.id === id);
    if (!current) return;
    const room = SOURCE_TOTAL - current.sources.length;
    if (room <= 0) return;
    const form = new FormData();
    appendFiles(form, files.slice(0, room));
    try {
      const doc = await apiAddSources(id, form);
      get().upsert(mapDocument(doc));
    } catch {
      // Live events / refresh recover.
    }
  },
  beginAddSources: async (id, files) => {
    if (files.length === 0) return;
    const current = get().items.find((item) => item.id === id);
    if (!current) return;
    const room = SOURCE_TOTAL - current.sources.length;
    if (room <= 0) return;
    const slice = files.slice(0, room);
    if (get().addingToId) return;
    set({ addingToId: id, pendingDeleteId: null });
    try {
      const results = await inspectFiles(slice);
      const unique: File[] = [];
      const dupFiles: File[] = [];
      const dupResults: InspectResult[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < slice.length; i += 1) {
        const result = results[i];
        const digest = result.digest ?? "";
        const intra = digest !== "" && seen.has(digest);
        if (digest) seen.add(digest);
        if (result.ok && (intra || result.uniqueness === "duplicate")) {
          dupFiles.push(slice[i]);
          dupResults.push(result);
          continue;
        }
        unique.push(slice[i]);
      }
      if (unique.length > 0) {
        await get().addSources(id, unique);
      }
      if (dupFiles.length > 0) {
        set({
          pendingSourceAdd: { docId: id, files: dupFiles, results: dupResults },
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await get().addSources(id, slice);
    } finally {
      if (get().addingToId === id) set({ addingToId: null });
    }
  },
  confirmPendingAdd: async () => {
    const pending = get().pendingSourceAdd;
    if (!pending) return;
    set({ pendingSourceAdd: null });
    await get().addSources(pending.docId, pending.files);
  },
  cancelPendingAdd: () => {
    if (get().pendingSourceAdd === null) return;
    set({ pendingSourceAdd: null });
  },
  openView: (id) => {
    const current = get().items.find((item) => item.id === id);
    if (!current) return;
    if (get().pendingViewId === id) return;
    set({ pendingViewId: id, pendingDeleteId: null });
  },
  closeView: () => {
    if (get().pendingViewId === null) return;
    set({ pendingViewId: null });
  },
  askRemove: (id) => {
    const current = get().items.find((item) => item.id === id);
    if (!current || inFlightDeletes.has(id)) return;
    if (get().pendingDeleteId === id) return;
    set({ pendingDeleteId: id, pendingViewId: null });
  },
  cancelRemove: () => {
    if (get().pendingDeleteId === null) return;
    set({ pendingDeleteId: null });
  },
  confirmRemove: async () => {
    const id = get().pendingDeleteId;
    if (!id) return;
    const current = get().items.find((item) => item.id === id);
    set({ pendingDeleteId: null });
    if (!current || inFlightDeletes.has(id)) return;
    inFlightDeletes.set(id, current);
    get().dropLocal(id);
    try {
      await deleteDocument(id);
    } catch (error) {
      inFlightDeletes.delete(id);
      if (!(error instanceof ApiError && error.status === 404)) {
        get().upsert(current);
      }
    } finally {
      inFlightDeletes.delete(id);
    }
  },
}));

export function selectVisibleCount(state: DocumentsState): number {
  return state.visibleItems.length;
}

export async function suggestErp(): Promise<string> {
  try {
    const { erp } = await fetchNextErp();
    if (erp) return erp;
  } catch {
    // Fall through to local suggestion.
  }
  return nextErpCode(useDocumentsStore.getState().items);
}

export function erpTaken(erp: string, exceptId?: string): boolean {
  const code = erp.trim().toLowerCase();
  if (!code) return false;
  return useDocumentsStore
    .getState()
    .items.some(
      (item) => item.id !== exceptId && item.erp.toLowerCase() === code,
    );
}

export { SOURCE_TOTAL };
