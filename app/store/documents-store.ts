import { create } from "zustand";
import {
  ApiError,
  addSources as apiAddSources,
  createDocument,
  deleteDocument,
  inspectFiles,
  listDocuments,
  nextErp as fetchNextErp,
  userFacingApiError,
  type ApiDocument,
  type ApiSource,
  type AuthRole,
  type InspectResult,
} from "@/app/lib/api";
import { anzscoMatches, foldSearch } from "@/app/lib/anzsco";
import { findTeam } from "@/app/lib/teams";
import { formatDate, formatDateTime, toDayKey } from "@/app/lib/dates";
import { SOURCE_TOTAL, parseDocumentStatus, parseUniqueness, type DocumentStatus, type SourceUniqueness } from "@/app/lib/files";
import {
  displayTitle,
  isPrintedTitle,
  isTitlePending,
  UNREADABLE_TITLE,
} from "@/app/lib/titles";
import { isAdmin, useUserStore } from "@/app/store/user-store";

export type DuplicateMatch = {
  id: string
  sourceId?: string
  documentId?: string
  title: string
  erp: string
  client?: string
  member?: string
  score: number
  uploaded: string
  uniqueness: SourceUniqueness
  fileUrl?: string
  contentType?: string
  /** Member's reason for keeping this duplicate. Only set on duplicates. */
  note?: string
  /** Combined history for this file cluster. Documents table uses this. */
  noteLog?: string
};

export type TitleSimilarMatch = {
  id: string
  sourceId?: string
  documentId?: string
  title: string
  erp: string
  client?: string
  member?: string
  score: number
  uploaded: string
  fileUrl?: string
  contentType?: string
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
  titleSimilar: TitleSimilarMatch[]
  fileUrl?: string
  /** Member's reason for keeping this duplicate. Only set on duplicates. */
  note?: string
  noteLog?: string
  needsTitle?: boolean
};

export type DocumentItem = {
  id: string
  title: string
  uploader: string
  ownerId?: string
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
  reviewNote?: string
  reviewRequestedAt?: string
  titlePending?: boolean
  titleSimilar: TitleSimilarMatch[]
};

export type NewDocumentInput = {
  client: string
  erp: string
  anzsco: string
  team: string
  member: string
  files: File[]
  titles?: string[]
  notes?: string[]
};

export type PendingCompare = {
  docId: string
  sourceId: string
};

export type PendingSourceAdd = {
  docId: string
  files: File[]
  results: InspectResult[]
  uniqueFiles?: File[]
};

export type WriteResult =
  | { ok: true }
  | { ok: false; reason: "erp" | "files" | "error"; message?: string };

export type PeopleKind = "all" | "member" | "admin";

export type UserDirectoryEntry = {
  id: string
  name: string
  role: AuthRole
};

type DocumentsState = {
  query: string
  dateFrom: string | null
  dateTo: string | null
  userKind: PeopleKind
  teamFilter: string
  userDirectory: UserDirectoryEntry[]
  items: DocumentItem[]
  visibleItems: DocumentItem[]
  expandedId: string | null
  inspect: Record<string, true>
  pendingCompare: PendingCompare | null
  pendingDeleteId: string | null
  pendingViewId: string | null
  pendingSimilarId: string | null
  pendingSourceAdd: PendingSourceAdd | null
  addingToId: string | null
  actionError: string
  setQuery: (query: string) => void
  setDateRange: (from: string | null, to: string | null) => void
  setPeopleFilter: (userKind: PeopleKind, team: string) => void
  setUserDirectory: (users: UserDirectoryEntry[]) => void
  toggleExpanded: (id: string) => void
  toggleInspect: (docId: string, sourceId: string) => void
  openCompare: (docId: string, sourceId: string) => void
  closeCompare: () => void
  replaceAll: (items: DocumentItem[]) => void
  upsert: (item: DocumentItem) => void
  dropLocal: (id: string) => void
  refresh: () => Promise<void>
  addDocument: (input: NewDocumentInput) => Promise<WriteResult>
  addSources: (id: string, files: File[], notes?: string[]) => Promise<WriteResult>
  beginAddSources: (id: string, files: File[]) => Promise<void>
  confirmPendingAdd: (notes?: string[]) => Promise<WriteResult>
  cancelPendingAdd: () => void
  clearActionError: () => void
  resetSession: () => void
  openView: (id: string) => void
  closeView: () => void
  openSimilar: (id: string) => void
  closeSimilar: () => void
  askRemove: (id: string) => void
  cancelRemove: () => void
  confirmRemove: () => Promise<void>
};

const EMPTY: DocumentItem[] = [];
let refreshLock = false;
let refreshAgain = false;
let mutateGen = 0;
let addInspectCtl: AbortController | null = null;
let addInspectDoc: string | null = null;
const inFlightDeletes = new Map<string, DocumentItem>();

function bumpMutate() {
  mutateGen += 1;
}

function abortAddInspect(id?: string) {
  if (id && addInspectDoc !== id) return;
  addInspectCtl?.abort();
  addInspectCtl = null;
  addInspectDoc = null;
}

function matchesQuery(item: DocumentItem, query: string): boolean {
  if (!query) return true;
  return (
    foldSearch(item.client).includes(query) ||
    foldSearch(item.team).includes(query) ||
    anzscoMatches(item.anzsco, query)
  );
}

function matchesDate(item: DocumentItem, from: string | null, to: string | null) {
  if (!from && !to) return true;
  const key = toDayKey(item.uploadedAt);
  if (!key) return false;
  const start = from && to && from > to ? to : (from ?? to);
  const end = from && to && from > to ? from : (to ?? from);
  if (start && key < start) return false;
  if (end && key > end) return false;
  return true;
}

function matchesTeam(item: DocumentItem, team: string) {
  const want = team.trim();
  if (!want) return true;
  const got = findTeam(item.team) ?? item.team.trim();
  return foldSearch(got) === foldSearch(want);
}

function directoryRole(
  item: DocumentItem,
  directory: UserDirectoryEntry[],
): AuthRole {
  if (item.ownerId) {
    const byId = directory.find((user) => user.id === item.ownerId);
    if (byId) return byId.role;
  }
  const who = foldSearch(item.member || item.uploader);
  if (!who) return "member";
  const byName = directory.find((user) => foldSearch(user.name) === who);
  if (byName) return byName.role;
  const self = useUserStore.getState();
  if (self.signedIn && foldSearch(self.name) === who && (self.role === "admin" || self.role === "member")) {
    return self.role;
  }
  return "member";
}

function matchesPeople(
  item: DocumentItem,
  kind: PeopleKind,
  directory: UserDirectoryEntry[],
) {
  if (kind === "all") return true;
  return directoryRole(item, directory) === kind;
}

function filterItems(
  items: DocumentItem[],
  query: string,
  from: string | null,
  to: string | null,
  userKind: PeopleKind,
  team: string,
  directory: UserDirectoryEntry[],
): DocumentItem[] {
  const q = foldSearch(query);
  return items.filter((item) => {
    if (q && !matchesQuery(item, q)) return false;
    if (!matchesDate(item, from, to)) return false;
    if (!matchesTeam(item, team)) return false;
    return matchesPeople(item, userKind, directory);
  });
}

function visibleOf(state: {
  items: DocumentItem[]
  query: string
  dateFrom: string | null
  dateTo: string | null
  userKind: PeopleKind
  teamFilter: string
  userDirectory: UserDirectoryEntry[]
}) {
  return filterItems(
    state.items,
    state.query,
    state.dateFrom,
    state.dateTo,
    state.userKind,
    state.teamFilter,
    state.userDirectory,
  );
}

export function listedDocuments(items: DocumentItem[], role: string) {
  return role === "admin"
    ? items.filter((item) => item.status !== "pending_review")
    : items;
}

export function listedFileCount(items: DocumentItem[], role: string) {
  return listedDocuments(items, role).reduce(
    (sum, item) => sum + item.sources.length,
    0,
  );
}

export function peopleFilterActive(userKind: PeopleKind, team: string) {
  return userKind !== "all" || Boolean(team.trim());
}

function pruneInspectForItem(
  inspect: Record<string, true>,
  item: DocumentItem,
): Record<string, true> {
  const prefix = `${item.id}::`;
  let next: Record<string, true> | null = null;
  for (const key of Object.keys(inspect)) {
    if (!key.startsWith(prefix)) continue;
    const sourceId = key.slice(prefix.length);
    if (item.sources.some((source) => source.id === sourceId)) continue;
    if (!next) next = { ...inspect };
    delete next[key];
  }
  return next ?? inspect;
}

function compareStillOpen(
  pending: PendingCompare | null,
  items: DocumentItem[],
): PendingCompare | null {
  if (!pending) return null;
  const item = items.find((row) => row.id === pending.docId);
  if (!item) return null;
  if (!item.sources.some((source) => source.id === pending.sourceId)) return null;
  return pending;
}

function similarStillOpen(id: string | null, items: DocumentItem[]): string | null {
  if (!id) return null;
  const item = items.find((row) => row.id === id);
  if (!item || item.titleSimilar.length === 0) return null;
  return id;
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

function mapSimilar(match: {
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
}): TitleSimilarMatch {
  return {
    id: match.id,
    sourceId: match.source_id,
    documentId: match.document_id,
    title: displayTitle(match.title),
    erp: match.erp,
    client: match.client,
    member: match.member,
    score: match.score,
    uploaded: formatDateTime(match.uploaded_at),
    fileUrl: match.file_url,
    contentType: match.content_type,
  };
}

function uniqueSimilar(
  matches: TitleSimilarMatch[],
  selfDocumentId?: string,
): TitleSimilarMatch[] {
  const best = new Map<string, TitleSimilarMatch>();
  for (const match of matches) {
    const sameDoc = Boolean(selfDocumentId && match.documentId === selfDocumentId);
    const key = sameDoc
      ? `s:${match.sourceId || match.id}`
      : `d:${match.documentId || match.id}`;
    const prev = best.get(key);
    if (!prev || match.score > prev.score) best.set(key, match);
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

function titleRank(title: string): number {
  if (isPrintedTitle(title) || title === UNREADABLE_TITLE) return 2;
  return 0;
}

function preferTitle(next: string, prev: string): string {
  return titleRank(prev) > titleRank(next) ? prev : next;
}

function hashDecided(source: SourceFile): boolean {
  return (
    source.uniqueness === "original" ||
    source.uniqueness === "duplicate" ||
    source.duplicates.length > 0 ||
    source.score != null
  );
}

function sourceIdsKey(item: DocumentItem): string {
  return item.sources
    .map((source) => source.id)
    .sort()
    .join("\0");
}

function preferSource(prev: SourceFile | undefined, next: SourceFile): SourceFile {
  if (!prev) return next;
  const title = preferTitle(next.title, prev.title);
  const settled = isPrintedTitle(title) || title === UNREADABLE_TITLE;
  const staleHash = hashDecided(prev) && !hashDecided(next);
  const weaker =
    titleRank(next.title) < titleRank(prev.title) || staleHash;
  return {
    ...next,
    title,
    needsTitle: settled ? false : next.needsTitle,
    uniqueness: staleHash ? prev.uniqueness : next.uniqueness,
    score: staleHash ? prev.score : next.score,
    duplicates: staleHash ? prev.duplicates : next.duplicates,
    note: staleHash ? prev.note : next.note,
    noteLog: staleHash ? prev.noteLog : next.noteLog,
    titleSimilar:
      weaker && next.titleSimilar.length === 0
        ? prev.titleSimilar
        : next.titleSimilar,
  };
}

function preferItem(prev: DocumentItem, next: DocumentItem): DocumentItem {
  const incoming =
    next.sources.length === 0 && prev.sources.length > 0
      ? prev.sources
      : next.sources;
  const prevById = new Map(prev.sources.map((source) => [source.id, source]));
  const sources = incoming.map((source) =>
    preferSource(prevById.get(source.id), source),
  );
  const title = preferTitle(next.title, prev.title);
  const sameSources = sourceIdsKey(prev) === sourceIdsKey(next);
  const status =
    next.status === "processing" &&
    prev.status !== "processing" &&
    sameSources
      ? prev.status
      : next.status;
  return {
    ...next,
    title,
    fileUrl: next.fileUrl || prev.fileUrl,
    status,
    sources,
    titlePending: isTitlePending(title),
    titleSimilar: uniqueSimilar(
      sources.flatMap((source) => source.titleSimilar),
      next.id,
    ),
  };
}

function mapSource(source: ApiSource): SourceFile {
  const title = displayTitle(source.title);
  return {
    id: source.id,
    title,
    uploaded: formatDateTime(source.uploaded_at),
    score: source.score,
    uniqueness: parseUniqueness(source.uniqueness),
    contentType: source.content_type,
    sizeBytes: source.size_bytes,
    fileUrl: source.file_url,
    note: source.note?.trim() || undefined,
    noteLog: source.note_log?.trim() || undefined,
    needsTitle: isTitlePending(source.title, source.needs_title),
    duplicates: (source.duplicates ?? []).map((match) => ({
      id: match.id,
      sourceId: match.source_id,
      documentId: match.document_id,
      title: displayTitle(match.title),
      erp: match.erp,
      client: match.client,
      member: match.member,
      score: match.score,
      uploaded: formatDateTime(match.uploaded_at),
      uniqueness: parseUniqueness(match.uniqueness),
      fileUrl: match.file_url,
      contentType: match.content_type,
      note: match.note?.trim() || undefined,
      noteLog: match.note_log?.trim() || undefined,
    })),
    titleSimilar: (source.title_similar ?? []).map(mapSimilar),
  };
}

export function mapDocument(raw: ApiDocument): DocumentItem {
  const sources = (raw.sources ?? []).map(mapSource);
  const titleSimilar = uniqueSimilar(
    sources.flatMap((source) => source.titleSimilar),
    raw.id,
  );
  return {
    id: raw.id,
    title: displayTitle(raw.title),
    uploader: raw.uploader || raw.member,
    ownerId: raw.owner_id,
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
    reviewNote: raw.review_note?.trim() || undefined,
    reviewRequestedAt: raw.review_requested_at || undefined,
    titlePending:
      Boolean(raw.title_pending) || isTitlePending(raw.title),
    titleSimilar,
  };
}

function appendFiles(form: FormData, files: File[], titles?: string[], notes?: string[]) {
  for (let i = 0; i < files.length; i += 1) {
    form.append("files", files[i]);
    form.append("titles", titles?.[i] ?? "");
    form.append("notes", notes?.[i] ?? "");
  }
}

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  query: "",
  dateFrom: null,
  dateTo: null,
  userKind: "all",
  teamFilter: "",
  userDirectory: [],
  items: EMPTY,
  visibleItems: EMPTY,
  expandedId: null,
  inspect: {},
  pendingCompare: null,
  pendingDeleteId: null,
  pendingViewId: null,
  pendingSimilarId: null,
  pendingSourceAdd: null,
  addingToId: null,
  actionError: "",
  setQuery: (query) => {
    if (get().query === query) return;
    set((state) => ({
      query,
      visibleItems: visibleOf({ ...state, query }),
    }));
  },
  setDateRange: (dateFrom, dateTo) => {
    const from = dateFrom || null;
    const to = dateTo || null;
    if (get().dateFrom === from && get().dateTo === to) return;
    set((state) => ({
      dateFrom: from,
      dateTo: to,
      visibleItems: visibleOf({ ...state, dateFrom: from, dateTo: to }),
    }));
  },
  setPeopleFilter: (userKind, team) => {
    const nextTeam = team.trim();
    if (get().userKind === userKind && get().teamFilter === nextTeam) return;
    set((state) => ({
      userKind,
      teamFilter: nextTeam,
      visibleItems: visibleOf({ ...state, userKind, teamFilter: nextTeam }),
    }));
  },
  setUserDirectory: (users) => {
    const next = users.map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role,
    }));
    const prev = get().userDirectory;
    if (
      prev.length === next.length &&
      prev.every((user, index) =>
        user.id === next[index]?.id &&
        user.name === next[index]?.name &&
        user.role === next[index]?.role,
      )
    ) {
      return;
    }
    set((state) => ({
      userDirectory: next,
      visibleItems: visibleOf({ ...state, userDirectory: next }),
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
  openCompare: (docId, sourceId) => {
    const current = get().items.find((item) => item.id === docId);
    if (!current || !current.sources.some((source) => source.id === sourceId)) return;
    const pending = get().pendingCompare;
    if (pending?.docId === docId && pending.sourceId === sourceId) return;
    set({
      pendingCompare: { docId, sourceId },
      pendingDeleteId: null,
      pendingViewId: null,
      pendingSimilarId: null,
    });
  },
  closeCompare: () => {
    if (get().pendingCompare === null) return;
    set({ pendingCompare: null });
  },
  replaceAll: (items) => {
    set((state) => {
      const keptRaw =
        inFlightDeletes.size === 0
          ? items
          : items.filter((item) => !inFlightDeletes.has(item.id));
      const prevById = new Map(state.items.map((item) => [item.id, item]));
      const kept = keptRaw.map((item) => {
        const prev = prevById.get(item.id);
        return prev ? preferItem(prev, item) : item;
      });
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
      const pendingCompare = compareStillOpen(state.pendingCompare, next);
      const pendingSimilarId = similarStillOpen(state.pendingSimilarId, next);
      const pendingSourceAdd =
        state.pendingSourceAdd &&
        next.some((item) => item.id === state.pendingSourceAdd?.docId)
          ? state.pendingSourceAdd
          : null;
      const addingToId =
        state.addingToId && next.some((item) => item.id === state.addingToId)
          ? state.addingToId
          : null;
      return {
        items: next,
        visibleItems: visibleOf({ ...state, items: next }),
        expandedId,
        pendingDeleteId,
        pendingViewId,
        pendingSimilarId,
        pendingCompare,
        pendingSourceAdd,
        addingToId,
      };
    });
  },
  upsert: (item) => {
    if (inFlightDeletes.has(item.id)) return;
    bumpMutate();
    set((state) => {
      const index = state.items.findIndex((current) => current.id === item.id);
      const items =
        index === -1
          ? [item, ...state.items]
          : state.items.map((current) =>
              current.id === item.id ? preferItem(current, item) : current,
            );
      return {
        items,
        visibleItems: visibleOf({ ...state, items }),
        inspect: pruneInspectForItem(state.inspect, item),
        pendingCompare: compareStillOpen(state.pendingCompare, items),
        pendingSimilarId: similarStillOpen(state.pendingSimilarId, items),
      };
    });
  },
  dropLocal: (id) => {
    abortAddInspect(id);
    if (!get().items.some((item) => item.id === id)) return;
    bumpMutate();
    set((state) => {
      const items = state.items.filter((item) => item.id !== id);
      const inspect = omitPrefixed(state.inspect, `${id}::`) ?? state.inspect;
      return {
        items: items.length === 0 ? EMPTY : items,
        visibleItems: visibleOf({
          ...state,
          items: items.length === 0 ? EMPTY : items,
        }),
        expandedId: state.expandedId === id ? null : state.expandedId,
        pendingDeleteId:
          state.pendingDeleteId === id ? null : state.pendingDeleteId,
        pendingViewId: state.pendingViewId === id ? null : state.pendingViewId,
        pendingSimilarId:
          state.pendingSimilarId === id ? null : state.pendingSimilarId,
        pendingCompare:
          state.pendingCompare?.docId === id ? null : state.pendingCompare,
        pendingSourceAdd:
          state.pendingSourceAdd?.docId === id ? null : state.pendingSourceAdd,
        inspect,
      };
    });
  },
  refresh: async () => {
    if (refreshLock) {
      refreshAgain = true;
      return;
    }
    refreshLock = true;
    try {
      let rounds = 0;
      do {
        refreshAgain = false;
        const snap = mutateGen;
        const { items } = await listDocuments();
        if (mutateGen !== snap) {
          refreshAgain = true;
          rounds += 1;
          if (rounds < 8) continue;
          break;
        }
        get().replaceAll(items.map(mapDocument));
      } while (refreshAgain);
    } catch {
      // Connection status is owned by the backend heartbeat.
    } finally {
      refreshLock = false;
      if (refreshAgain) void get().refresh();
    }
  },
  addDocument: async (input) => {
    const files = input.files.slice(0, SOURCE_TOTAL);
    if (files.length === 0) return { ok: false, reason: "files" };
    const erp = input.erp.trim();
    if (!erp) return { ok: false, reason: "erp" };
    const taken = get().items.some(
      (item) => item.erp.toLowerCase() === erp.toLowerCase(),
    );
    if (taken) return { ok: false, reason: "erp" };
    const member =
      input.member.trim() || useUserStore.getState().name || "User";
    const form = new FormData();
    form.set("client", input.client.trim());
    form.set("erp", erp);
    form.set("anzsco", input.anzsco.trim());
    form.set("team", input.team.trim());
    form.set("member", member);
    appendFiles(form, files, input.titles, input.notes);
    try {
      const doc = await createDocument(form);
      get().upsert(mapDocument(doc));
      set({ actionError: "" });
      return { ok: true };
    } catch (error) {
      if (error instanceof ApiError && error.code === "erp_taken") {
        return { ok: false, reason: "erp" };
      }
      const message = userFacingApiError(error);
      set({ actionError: message });
      return { ok: false, reason: "error", message };
    }
  },
  addSources: async (id, files, notes) => {
    if (files.length === 0) return { ok: false, reason: "files" };
    const current = get().items.find((item) => item.id === id);
    if (!current) return { ok: false, reason: "error", message: "Document is gone." };
    const room = SOURCE_TOTAL - current.sources.length;
    if (room <= 0) {
      return { ok: false, reason: "error", message: "You can attach at most 4 sources." };
    }
    const form = new FormData();
    appendFiles(form, files.slice(0, room), undefined, notes?.slice(0, room));
    try {
      const doc = await apiAddSources(id, form);
      get().upsert(mapDocument(doc));
      set({ actionError: "" });
      return { ok: true };
    } catch (error) {
      const message = userFacingApiError(error);
      set({ actionError: message });
      return { ok: false, reason: "error", message };
    }
  },
  beginAddSources: async (id, files) => {
    if (files.length === 0) return;
    const current = get().items.find((item) => item.id === id);
    if (!current) return;
    const room = SOURCE_TOTAL - current.sources.length;
    if (room <= 0) return;
    const slice = files.slice(0, room);
    if (get().addingToId || get().pendingSourceAdd) return;
    abortAddInspect();
    const ctl = new AbortController();
    addInspectCtl = ctl;
    addInspectDoc = id;
    set({ addingToId: id, pendingDeleteId: null });
    try {
      const results = await inspectFiles(slice, ctl.signal);
      if (ctl.signal.aborted || !get().items.find((item) => item.id === id)) return;
      const unique: File[] = [];
      const dupFiles: File[] = [];
      const dupResults: InspectResult[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < slice.length; i += 1) {
        const result = results[i];
        if (!result?.ok) continue;
        const digest = result.digest ?? "";
        const intra = digest !== "" && seen.has(digest);
        if (digest) seen.add(digest);
        if (intra || result.uniqueness === "duplicate") {
          dupFiles.push(slice[i]);
          dupResults.push(result);
          continue;
        }
        unique.push(slice[i]);
      }
      if (dupFiles.length > 0) {
        if (!get().items.find((item) => item.id === id)) return;
        set({
          pendingSourceAdd: {
            docId: id,
            files: dupFiles,
            results: dupResults,
            uniqueFiles: unique,
          },
        });
        return;
      }
      if (unique.length > 0) {
        const written = await get().addSources(id, unique);
        if (!written.ok) {
          set({
            actionError:
              written.message || "Couldn’t add those files. Try again.",
          });
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof Error && error.name === "AbortError") return;
      set({ actionError: userFacingApiError(error) });
    } finally {
      if (addInspectDoc === id) {
        addInspectCtl = null;
        addInspectDoc = null;
      }
      if (get().addingToId === id) set({ addingToId: null });
    }
  },
  confirmPendingAdd: async (notes) => {
    const pending = get().pendingSourceAdd;
    if (!pending || get().addingToId) {
      return { ok: false, reason: "error", message: "Nothing to add." };
    }
    const reasons = pending.files.map((_, index) => notes?.[index]?.trim() ?? "");
    if (reasons.some((value) => value.length === 0)) {
      return {
        ok: false,
        reason: "error",
        message:
          pending.files.length === 1
            ? "Add a note on the duplicate file."
            : "Add a note on each duplicate file.",
      };
    }
    set({ addingToId: pending.docId, actionError: "" });
    try {
      if (!get().items.find((item) => item.id === pending.docId)) {
        set({ pendingSourceAdd: null });
        return { ok: false, reason: "error", message: "Document is gone." };
      }
      const uniqueFiles = pending.uniqueFiles ?? [];
      const files = [...uniqueFiles, ...pending.files];
      const allNotes = [...uniqueFiles.map(() => ""), ...reasons];
      const result = await get().addSources(pending.docId, files, allNotes);
      if (result.ok) set({ pendingSourceAdd: null });
      return result;
    } finally {
      if (get().addingToId === pending.docId) set({ addingToId: null });
    }
  },
  cancelPendingAdd: () => {
    if (get().pendingSourceAdd === null) return;
    set({ pendingSourceAdd: null });
  },
  clearActionError: () => {
    if (!get().actionError) return;
    set({ actionError: "" });
  },
  resetSession: () => {
    abortAddInspect();
    set({
      items: EMPTY,
      visibleItems: EMPTY,
      expandedId: null,
      inspect: {},
      pendingCompare: null,
      pendingDeleteId: null,
      pendingViewId: null,
      pendingSimilarId: null,
      pendingSourceAdd: null,
      addingToId: null,
      actionError: "",
      userKind: "all",
      teamFilter: "",
      userDirectory: [],
    });
  },
  openView: (id) => {
    const current = get().items.find((item) => item.id === id);
    if (!current) return;
    if (get().pendingViewId === id) return;
    set({ pendingViewId: id, pendingDeleteId: null, pendingCompare: null, pendingSimilarId: null });
  },
  closeView: () => {
    if (get().pendingViewId === null) return;
    set({ pendingViewId: null });
  },
  openSimilar: (id) => {
    const current = get().items.find((item) => item.id === id);
    if (!current || current.titleSimilar.length === 0) return;
    if (get().pendingSimilarId === id) return;
    set({ pendingSimilarId: id, pendingDeleteId: null, pendingCompare: null, pendingViewId: null });
  },
  closeSimilar: () => {
    if (get().pendingSimilarId === null) return;
    set({ pendingSimilarId: null });
  },
  askRemove: (id) => {
    if (!isAdmin(useUserStore.getState().role)) return;
    const current = get().items.find((item) => item.id === id);
    if (!current || inFlightDeletes.has(id)) return;
    if (get().pendingDeleteId === id) return;
    set({ pendingDeleteId: id, pendingViewId: null, pendingCompare: null, pendingSimilarId: null });
  },
  cancelRemove: () => {
    if (get().pendingDeleteId === null) return;
    set({ pendingDeleteId: null });
  },
  confirmRemove: async () => {
    if (!isAdmin(useUserStore.getState().role)) {
      if (get().pendingDeleteId !== null) set({ pendingDeleteId: null });
      return;
    }
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
