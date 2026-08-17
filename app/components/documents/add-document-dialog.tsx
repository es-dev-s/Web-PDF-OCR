"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Plus, Upload, X } from "lucide-react";
import { AnzscoSelect } from "@/app/components/documents/anzsco-select";
import { TeamSelect } from "@/app/components/documents/team-select";
import { DocTitle } from "@/app/components/documents/doc-title";
import { MatchLine, matchFactsLabel } from "@/app/components/documents/duplicate-note";
import { PreUploadCompare } from "@/app/components/documents/pre-upload-compare";
import { inspectFile, inspectMatchUrl, suggestTitle } from "@/app/lib/api";
import { formatDateTime } from "@/app/lib/dates";
import { SOURCE_TOTAL, uniquenessMeta, type SourceUniqueness } from "@/app/lib/files";
import { documentName, storedTitle } from "@/app/lib/titles";
import { findTeam } from "@/app/lib/teams";
import { useChromeStore } from "@/app/store/chrome-store";
import {
  erpTaken,
  suggestErp,
  useDocumentsStore,
} from "@/app/store/documents-store";
import { isAdmin, useUserStore } from "@/app/store/user-store";

const ACCEPT = ".pdf,application/pdf,image/*";

// Fixed columns keep the icon, status and remove control aligned down the list
// no matter how long a title or match line runs.
const FILE_COLS = "grid-cols-[1.125rem_minmax(0,1fr)_auto_1.75rem]";

const FILE_PILL =
  "inline-flex h-5 w-[4.75rem] shrink-0 items-center justify-center rounded-full text-[10px] font-medium";

function hasFiles(event: { dataTransfer?: DataTransfer | null }) {
  return Boolean(event.dataTransfer?.types.includes("Files"));
}

function isAllowed(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return true;
  return file.type.startsWith("image/");
}

const TITLE_CONCURRENCY = 2;

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

type TitleEntry = { pending: boolean; value: string };

function useSourceTitles(files: File[]) {
  const [titles, setTitles] = useState<Record<string, TitleEntry>>({});
  const abortByKey = useRef(new Map<string, AbortController>());
  const queue = useRef<File[]>([]);
  const active = useRef(0);
  const started = useRef(new Set<string>());

  // Named so it can re-enter itself as each request settles; every value it
  // touches is a ref or a stable setter, so it never needs rebuilding.
  const pump = useCallback(function drain() {
    while (active.current < TITLE_CONCURRENCY && queue.current.length > 0) {
      const file = queue.current.shift()!;
      const key = fileKey(file);
      const ac = new AbortController();
      abortByKey.current.set(key, ac);
      active.current += 1;
      void suggestTitle(file, ac.signal)
        .then((data) => {
          if (ac.signal.aborted) return;
          const value = documentName(data);
          setTitles((prev) =>
            prev[key] ? { ...prev, [key]: { pending: false, value } } : prev,
          );
        })
        .catch((error) => {
          if (ac.signal.aborted || isAbortError(error)) return;
          setTitles((prev) =>
            prev[key]
              ? { ...prev, [key]: { pending: false, value: "Untitled document" } }
              : prev,
          );
        })
        .finally(() => {
          abortByKey.current.delete(key);
          active.current = Math.max(0, active.current - 1);
          drain();
        });
    }
  }, []);

  const abortAll = useCallback(() => {
    queue.current = [];
    active.current = 0;
    started.current.clear();
    for (const ac of abortByKey.current.values()) ac.abort();
    abortByKey.current.clear();
  }, []);

  useEffect(() => {
    return () => abortAll();
  }, [abortAll]);

  useEffect(() => {
    const live = new Set(files.map(fileKey));
    for (const key of [...started.current]) {
      if (live.has(key)) continue;
      started.current.delete(key);
      abortByKey.current.get(key)?.abort();
      abortByKey.current.delete(key);
    }
    queue.current = queue.current.filter((file) => live.has(fileKey(file)));

    setTitles((prev) => {
      const next: Record<string, TitleEntry> = {};
      for (const file of files) {
        const key = fileKey(file);
        if (prev[key]) {
          next[key] = prev[key];
          continue;
        }
        next[key] = isPdfFile(file)
          ? { pending: true, value: "" }
          : { pending: false, value: file.name };
      }
      return next;
    });

    for (const file of files) {
      const key = fileKey(file);
      if (started.current.has(key)) continue;
      started.current.add(key);
      if (isPdfFile(file)) queue.current.push(file);
    }
    pump();
  }, [files, pump]);

  return titles;
}

function storedPreviewUrl(
  check: InspectEntry | undefined,
  items: Array<{
    id: string
    erp: string
    sources: Array<{ id: string; title: string; fileUrl?: string }>
  }>,
) {
  if (!check) return "";
  if (check.matchUrl) return check.matchUrl;
  if (check.matchDocumentId && check.matchId) {
    return `/backend/v1/documents/${check.matchDocumentId}/sources/${check.matchId}/file`;
  }
  const erp = (check.erp || "").trim().toLowerCase();
  const title = (check.matchTitle || "").trim().toLowerCase();
  if (!erp && !title) return "";
  for (const item of items) {
    if (erp && item.erp.trim().toLowerCase() !== erp) continue;
    const source =
      (title
        ? item.sources.find((row) => row.title.trim().toLowerCase() === title)
        : undefined) ?? item.sources[0];
    if (!source) continue;
    return (
      source.fileUrl ||
      `/backend/v1/documents/${item.id}/sources/${source.id}/file`
    );
  }
  return "";
}

function notedInspectMatch(
  matches: Array<{ note?: string; member?: string }> | undefined,
) {
  if (!matches?.length) return undefined;
  return matches.find((row) => row.note?.trim()) ?? matches[0];
}

function storedMatchNote(
  check: InspectEntry | undefined,
  items: Array<{
    member: string
    sources: Array<{
      id: string
      uniqueness: SourceUniqueness
      note?: string
      duplicates: Array<{
        id: string
        uniqueness: SourceUniqueness
        note?: string
        member?: string
      }>
    }>
  }>,
) {
  if (check?.matchNote?.trim()) {
    return { note: check.matchNote, who: check.matchNoteWho || check.member };
  }
  const matchId = check?.matchId;
  if (!matchId) {
    return { note: check?.matchNote, who: check?.matchNoteWho || check?.member };
  }

  let linked: { note?: string; who?: string } | undefined;
  for (const item of items) {
    for (const source of item.sources) {
      if (source.id === matchId) {
        if (source.note?.trim()) {
          return { note: source.note, who: item.member };
        }
        const fromDup = source.duplicates.find((row) => row.note?.trim());
        if (fromDup) {
          return { note: fromDup.note, who: fromDup.member || item.member };
        }
      }
      const asDup = source.duplicates.find((row) => row.id === matchId);
      if (asDup?.note?.trim()) {
        return { note: asDup.note, who: asDup.member || item.member };
      }
      if (
        source.uniqueness === "duplicate" &&
        source.note?.trim() &&
        source.duplicates.some((row) => row.id === matchId)
      ) {
        linked = { note: source.note, who: item.member };
      }
    }
  }
  return (
    linked ?? {
      note: check.matchNote,
      who: check.matchNoteWho || check.member,
    }
  );
}

function storedMatchContext(
  check: InspectEntry | undefined,
  items: Array<{
    id: string
    client: string
    erp: string
    anzsco: string
    team: string
    member: string
    sources: Array<{
      id: string
      duplicates: Array<{ id: string }>
    }>
  }>,
) {
  const fromInspect = {
    title: check?.matchTitle,
    client: check?.client,
    team: check?.team,
    anzsco: check?.anzsco,
    erp: check?.erp,
    member: check?.member,
  };
  if (!check) return fromInspect;
  const matchId = check.matchId;
  const docId = check.matchDocumentId;
  for (const item of items) {
    const hit =
      (docId && item.id === docId) ||
      item.sources.some(
        (source) =>
          source.id === matchId ||
          source.duplicates.some((row) => row.id === matchId),
      );
    if (!hit) continue;
    return {
      title: fromInspect.title,
      client: fromInspect.client?.trim() || item.client,
      team: fromInspect.team?.trim() || item.team,
      anzsco: fromInspect.anzsco?.trim() || item.anzsco,
      erp: fromInspect.erp?.trim() || item.erp,
      member: fromInspect.member?.trim() || item.member,
    };
  }
  return fromInspect;
}

type InspectEntry = {
  pending: boolean
  failed?: boolean
  server: "unique" | "duplicate"
  uniqueness: "unique" | "duplicate"
  digest?: string
  erp?: string
  member?: string
  client?: string
  anzsco?: string
  team?: string
  matchTitle?: string
  matchUrl?: string
  matchId?: string
  matchDocumentId?: string
  matchUniqueness?: SourceUniqueness
  matchNote?: string
  matchNoteWho?: string
  uploaded?: string
  intra?: boolean
};

async function inspectWithRetry(file: File, signal: AbortSignal) {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await inspectFile(file, signal);
    } catch (error) {
      if (isAbortError(error)) throw error;
      last = error;
    }
  }
  throw last;
}

function useSourceInspect(files: File[]) {
  const [inspect, setInspect] = useState<Record<string, InspectEntry>>({});
  const abortByKey = useRef(new Map<string, AbortController>());
  const queue = useRef<File[]>([]);
  const active = useRef(0);
  const started = useRef(new Set<string>());

  // Requests settle long after the render that started them, so the matcher
  // reads the current file list from a ref rather than a stale closure.
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const applyIntra = useCallback((current: Record<string, InspectEntry>) => {
    const seen = new Map<string, string>();
    const next: Record<string, InspectEntry> = {};
    for (const file of filesRef.current) {
      const key = fileKey(file);
      const entry = current[key];
      if (!entry) continue;
      next[key] = { ...entry, uniqueness: entry.server, intra: false };
      if (entry.pending || entry.failed || !entry.digest) continue;
      if (!seen.has(entry.digest)) {
        seen.set(entry.digest, key);
        continue;
      }
      next[key] = { ...next[key], uniqueness: "duplicate", intra: true };
    }
    return next;
  }, []);

  const pump = useCallback(function drain() {
    while (active.current < TITLE_CONCURRENCY && queue.current.length > 0) {
      const file = queue.current.shift()!;
      const key = fileKey(file);
      const ac = new AbortController();
      abortByKey.current.set(key, ac);
      active.current += 1;
      void inspectWithRetry(file, ac.signal)
        .then((data) => {
          if (ac.signal.aborted) return;
          const match = data.matches[0];
          const noted = notedInspectMatch(data.matches);
          const server =
            data.ok && data.uniqueness === "duplicate" ? "duplicate" : "unique";
          setInspect((prev) =>
            applyIntra({
              ...prev,
              [key]: {
                pending: false,
                failed: !data.ok,
                server,
                uniqueness: server,
                digest: data.digest,
                erp: match?.erp,
                member: match?.member,
                client: match?.client,
                anzsco: match?.anzsco,
                team: match?.team,
                matchTitle: match?.title,
                matchUrl: match ? inspectMatchUrl(match) : "",
                matchId: match?.id,
                matchDocumentId: match?.document_id,
                matchUniqueness: match?.uniqueness,
                matchNote: noted?.note,
                matchNoteWho: noted?.member,
                uploaded: match?.uploaded_at,
              },
            }),
          );
        })
        .catch((error) => {
          if (ac.signal.aborted || isAbortError(error)) return;
          setInspect((prev) =>
            applyIntra({
              ...prev,
              [key]: {
                pending: false,
                failed: true,
                server: "unique",
                uniqueness: "unique",
              },
            }),
          );
        })
        .finally(() => {
          abortByKey.current.delete(key);
          active.current = Math.max(0, active.current - 1);
          drain();
        });
    }
  }, [applyIntra]);

  const abortAll = useCallback(() => {
    queue.current = [];
    active.current = 0;
    started.current.clear();
    for (const ac of abortByKey.current.values()) ac.abort();
    abortByKey.current.clear();
  }, []);

  useEffect(() => {
    return () => abortAll();
  }, [abortAll]);

  useEffect(() => {
    const live = new Set(files.map(fileKey));
    for (const key of [...started.current]) {
      if (live.has(key)) continue;
      started.current.delete(key);
      abortByKey.current.get(key)?.abort();
      abortByKey.current.delete(key);
    }
    queue.current = queue.current.filter((file) => live.has(fileKey(file)));

    setInspect((prev) => {
      const next: Record<string, InspectEntry> = {};
      for (const file of files) {
        const key = fileKey(file);
        next[key] = prev[key] ?? {
          pending: true,
          server: "unique",
          uniqueness: "unique",
        };
      }
      return applyIntra(next);
    });

    for (const file of files) {
      const key = fileKey(file);
      if (started.current.has(key)) continue;
      started.current.add(key);
      queue.current.push(file);
    }
    pump();
  }, [files, pump, applyIntra]);

  return inspect;
}

function mergeFiles(current: File[], incoming: File[]) {
  const seen = new Set(current.map(fileKey));
  const next = current.slice();
  for (const file of incoming) {
    if (!isAllowed(file)) continue;
    const key = fileKey(file);
    if (seen.has(key)) continue;
    if (next.length >= SOURCE_TOTAL) break;
    seen.add(key);
    next.push(file);
  }
  return next;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
  inputRef,
  readOnly,
  error,
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
  inputRef?: React.RefObject<HTMLInputElement | null>
  readOnly?: boolean
  error?: string
}) {
  return (
    <label className="relative block min-w-0">
      <span className="mb-1.5 block text-[12px] font-medium text-muted">
        {label}
      </span>
      <input
        ref={inputRef}
        value={value}
        autoFocus={autoFocus}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={`h-9 w-full rounded-xl border bg-canvas px-3 text-[13px] text-ink outline-none placeholder:text-muted-soft ${
          error
            ? "border-red-300 focus:border-red-400"
            : "border-[var(--border)] focus:border-[var(--border-strong)]"
        }`}
      />
      {/* Absolutely placed so an error never reflows the field grid. */}
      {error ? (
        <span className="absolute left-0 top-full mt-1 text-[11px] leading-none text-red-600">
          {error}
        </span>
      ) : null}
    </label>
  );
}

type Props = {
  open: boolean
  onClose: () => void
};

// The form mounts only while the dialog is open, so every visit starts from a
// clean slate and there is no closed-state bookkeeping to unwind.
export function AddDocumentDialog({ open, onClose }: Props) {
  if (!open || typeof document === "undefined") return null;
  return <AddDocumentForm onClose={onClose} />;
}

function AddDocumentForm({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const addDocument = useDocumentsStore((s) => s.addDocument);
  const role = useUserStore((s) => s.role);
  const admin = isAdmin(role);
  const firstRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragCount = useRef(0);
  const busy = useRef(false);

  const erpGen = useRef(0);
  const erpTouched = useRef(false);
  const [client, setClient] = useState("");
  const [erp, setErp] = useState("");
  const [anzsco, setAnzsco] = useState("");
  const [team, setTeam] = useState("");
  const [member, setMember] = useState(() => useUserStore.getState().name);
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const [erpError, setErpError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [compareKey, setCompareKey] = useState("");
  const titles = useSourceTitles(files);
  const inspect = useSourceInspect(files);
  const items = useDocumentsStore((s) => s.items);

  // Keyed by file rather than index so removing a row cannot leave the compare
  // view pointed at the wrong file.
  const comparing = files.find((file) => fileKey(file) === compareKey) ?? null;
  const compareCheck = comparing ? inspect[compareKey] : undefined;
  const compareMatchUrl = storedPreviewUrl(compareCheck, items);
  const compareKept = storedMatchNote(compareCheck, items);
  const compareCtx = storedMatchContext(compareCheck, items);

  useEffect(() => {
    const gen = ++erpGen.current;
    useChromeStore.getState().setMenu(null);
    void suggestErp().then((code) => {
      if (gen !== erpGen.current || erpTouched.current) return;
      setErp(code);
    });
    const frame = window.requestAnimationFrame(() => firstRef.current?.focus());
    return () => {
      erpGen.current += 1;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onDragOver = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("dragover", onDragOver);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("dragover", onDragOver);
    };
  }, [onClose]);

  const addIncoming = (list: File[]) => {
    if (list.length === 0) return;
    setFiles((current) => mergeFiles(current, list));
  };

  const onDragEnter = (event: React.DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) return;
    dragCount.current += 1;
    setOver(true);
  };

  const onDragLeave = (event: React.DragEvent) => {
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) return;
    dragCount.current = 0;
    setOver(false);
  };

  const onDragOver = (event: React.DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    dragCount.current = 0;
    setOver(false);
    addIncoming(Array.from(event.dataTransfer.files ?? []));
  };

  const inspecting = files.some((file) => inspect[fileKey(file)]?.pending !== false);
  const hasDuplicate = files.some((file) => {
    const check = inspect[fileKey(file)];
    return Boolean(
      check && !check.pending && !check.failed && check.uniqueness === "duplicate",
    );
  });
  // Members must justify a duplicate before an admin will review it. Admins can
  // record the same reason, but nothing blocks them.
  const needsReason = !admin && hasDuplicate;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current || submitting) return;
    if (needsReason && note.trim().length === 0) return;
    if (erpTaken(erp)) {
      setErpError(true);
      return;
    }
    busy.current = true;
    setSubmitting(true);
    const result = await addDocument({
      client,
      erp,
      anzsco,
      team: findTeam(team) ?? "",
      member,
      files,
      titles: files.map((file) => {
        const entry = titles[fileKey(file)];
        if (!entry || entry.pending) return "";
        return storedTitle(entry.value);
      }),
      note: hasDuplicate ? note.trim() || undefined : undefined,
    });
    if (result === "erp") {
      busy.current = false;
      setSubmitting(false);
      setErpError(true);
      return;
    }
    if (result !== "ok") {
      busy.current = false;
      setSubmitting(false);
      return;
    }
    onClose();
  };

  const canSubmit =
    client.trim().length > 0 &&
    erp.trim().length > 0 &&
    files.length > 0 &&
    !erpError &&
    !submitting &&
    !inspecting &&
    (!needsReason || note.trim().length > 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/20"
        style={{ animation: "backdropIn 160ms var(--shell-ease) both" }}
        onClick={onClose}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={onSubmit}
        className="relative z-[1] flex w-full max-w-[min(48rem,calc(100vw-2rem))] max-h-[min(44rem,calc(100vh-2rem))] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-[var(--shadow-elevated)]"
        style={{ animation: "popoverIn 180ms var(--shell-ease) both" }}
      >
        <div className="flex h-12 shrink-0 items-center justify-between px-5">
          <h2
            id={titleId}
            className="text-[15px] font-semibold tracking-[-0.02em] text-ink"
          >
            Add document
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-muted outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <X className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
          </button>
        </div>
        <div className="h-px bg-[var(--border)]" />

        <div className="relative min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                label="Client Name"
                value={client}
                onChange={setClient}
                placeholder="Client name"
                autoFocus
                inputRef={firstRef}
              />
            </div>
            <Field
              label="ERP Code"
              value={erp}
              onChange={(value) => {
                erpTouched.current = true;
                setErp(value);
                if (erpError) setErpError(false);
              }}
              placeholder="ERP-10001"
              error={erpError ? "ERP code is already in use" : undefined}
            />
            <AnzscoSelect value={anzsco} onChange={setAnzsco} />
            <TeamSelect value={team} onChange={setTeam} />
            <Field
              label="Member"
              value={member}
              onChange={setMember}
              placeholder="Member"
              readOnly={!admin}
            />
          </div>

          <div className="mt-5">
            <div className="mb-1.5 flex h-5 items-center justify-between">
              <p className="text-[12px] font-medium text-muted">Upload</p>
              <p className="text-[11px] tabular-nums text-muted-soft">
                {files.length} / {SOURCE_TOTAL}
              </p>
            </div>
            <div
              className={`relative min-h-[11rem] overflow-hidden rounded-2xl bg-canvas ${
                files.length === 0
                  ? "border border-dashed border-[var(--border-strong)]"
                  : "border border-[var(--border)]"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                multiple
                hidden
                onChange={(event) => {
                  const list = event.target.files;
                  if (list && list.length > 0) addIncoming(Array.from(list));
                  event.target.value = "";
                }}
              />
              {files.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex min-h-[11rem] w-full flex-col items-center justify-center gap-2 px-4 text-center outline-none"
                >
                  <Upload
                    className="size-5 text-muted-soft"
                    strokeWidth={1.75}
                    absoluteStrokeWidth
                  />
                  <span className="text-[13px] font-medium text-ink">
                    Drop PDFs here
                  </span>
                  <span className="text-[12px] text-muted">
                    or click to browse · up to {SOURCE_TOTAL} sources
                  </span>
                </button>
              ) : (
                <div className="flex min-h-[11rem] flex-col">
                  <div className="flex h-8 shrink-0 items-center px-3">
                    <p className="text-[10px] font-medium tracking-[0.04em] text-muted-soft uppercase">
                      Source title
                    </p>
                  </div>
                  <ul>
                    {files.map((file, index) => {
                      const key = fileKey(file);
                      const entry = titles[key];
                      const pending = entry?.pending ?? isPdfFile(file);
                      const title = pending
                        ? "Generating title…"
                        : entry?.value || "Untitled document";
                      const check = inspect[key];
                      const checking = !check || check.pending;
                      const failed = Boolean(check?.failed);
                      const duplicate =
                        !checking && !failed && check?.uniqueness === "duplicate";
                      const uniqueMeta = uniquenessMeta(
                        duplicate ? "duplicate" : "unique",
                      );
                      const matchKept = storedMatchNote(check, items);
                      const matchCtx = storedMatchContext(check, items);
                      return (
                        <li
                          key={key}
                          className={`grid ${FILE_COLS} items-start gap-x-2.5 border-t border-[var(--border)] px-3 py-2.5 first:border-t-0`}
                        >
                          <FileText
                            className="mt-[3px] size-3.5 shrink-0 text-muted"
                            strokeWidth={1.75}
                            absoluteStrokeWidth
                          />
                          <div className="min-w-0">
                            <DocTitle
                              value={title}
                              className={`text-[13px] ${
                                pending ? "title-pulse text-muted" : "text-ink"
                              }`}
                            />
                            <span className="mt-0.5 block truncate text-[11px] text-muted-soft">
                              {file.name}
                            </span>
                          </div>
                          <div className="flex items-center justify-end gap-1 pt-px">
                            {checking ? (
                              <span className="title-pulse text-[11px] text-muted">
                                Checking…
                              </span>
                            ) : failed ? (
                              <span className="text-[11px] text-muted">
                                Not verified
                              </span>
                            ) : (
                              <span
                                className={`${FILE_PILL} ${uniqueMeta.className}`}
                              >
                                {uniqueMeta.label}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove ${file.name}`}
                            onClick={() =>
                              setFiles((current) =>
                                current.filter((_, i) => i !== index),
                              )
                            }
                            className="flex size-7 shrink-0 items-center justify-center justify-self-end rounded-lg text-muted outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                          >
                            <X className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
                          </button>
                          {duplicate ? (
                            <div className="col-span-3 col-start-2 min-w-0">
                              <MatchLine
                                match={matchCtx}
                                intra={Boolean(check?.intra)}
                                note={matchKept.note}
                                who={matchKept.who}
                                onCompare={
                                  check?.intra
                                    ? undefined
                                    : () => setCompareKey(key)
                                }
                              />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  {files.length < SOURCE_TOTAL ? (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="mt-auto flex h-10 items-center px-3 text-left text-[12px] font-medium text-muted outline-none hover:text-ink focus-visible:text-ink"
                    >
                      Add another source
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {hasDuplicate ? (
            <label className="mt-4 block min-w-0">
              <span className="mb-1.5 flex h-5 items-center justify-between">
                <span className="text-[12px] font-medium text-muted">
                  {needsReason ? "Reason for review" : "Reason for the duplicate"}
                </span>
                <span className="text-[11px] tabular-nums text-muted-soft">
                  {needsReason ? "Required" : "Optional"}
                </span>
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, 500))}
                rows={3}
                maxLength={500}
                required={needsReason}
                placeholder="Why should this duplicate be kept?"
                className="min-h-[4.5rem] w-full resize-none rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-[13px] leading-5 text-ink outline-none placeholder:text-muted-soft focus:border-[var(--border-strong)]"
              />
              <span className="mt-1.5 block text-[11px] leading-4 text-muted-soft">
                {needsReason
                  ? "An admin will see this with the pending files."
                  : "Saved on the duplicate so anyone reviewing it knows why it was kept."}
              </span>
            </label>
          ) : null}
        </div>

        {over ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[var(--row-open)]/92">
            <div className="flex flex-col items-center gap-2">
              <Upload
                className="size-6 text-accent"
                strokeWidth={1.75}
                absoluteStrokeWidth
              />
              <p className="text-[13px] font-medium text-ink">
                Drop to add sources
              </p>
            </div>
          </div>
        ) : null}

        <div className="h-px bg-[var(--border)]" />
        <div className="flex h-14 shrink-0 items-center justify-end gap-2 px-5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-xl px-3 text-[13px] font-medium text-muted outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-8 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-xl bg-ink px-4 text-[13px] font-medium tracking-[-0.015em] text-white outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:bg-ink/30 disabled:hover:bg-ink/30"
          >
            <Plus className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
            {needsReason ? "Request review" : "Add document"}
          </button>
        </div>
      </form>
      {comparing && (compareMatchUrl || compareCheck?.uniqueness === "duplicate") ? (
        <PreUploadCompare
          file={comparing}
          incomingTitle={
            titles[compareKey]?.value || comparing.name
          }
          matchTitle={compareCheck?.matchTitle || ""}
          matchFacts={[
            matchFactsLabel(compareCtx),
            compareCheck?.uploaded ? formatDateTime(compareCheck.uploaded) : "",
          ]
            .filter((part) => part && part.trim())
            .join(" · ")}
          matchUrl={compareMatchUrl}
          matchUniqueness={compareCheck?.matchUniqueness}
          matchNote={compareKept.note}
          matchWho={compareKept.who}
          onClose={() => setCompareKey("")}
        />
      ) : null}
    </div>,
    document.body,
  );
}
