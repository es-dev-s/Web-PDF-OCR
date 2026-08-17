"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Plus, Upload, X } from "lucide-react";
import { AnzscoSelect } from "@/app/components/documents/anzsco-select";
import { TeamSelect } from "@/app/components/documents/team-select";
import { DocTitle } from "@/app/components/documents/doc-title";
import { inspectFile, suggestTitle } from "@/app/lib/api";
import { formatDateTime } from "@/app/lib/dates";
import { SOURCE_TOTAL, uniquenessMeta } from "@/app/lib/files";
import { documentName, isPrintedTitle } from "@/app/lib/titles";
import { findTeam } from "@/app/lib/teams";
import { useChromeStore } from "@/app/store/chrome-store";
import {
  erpTaken,
  suggestErp,
  useDocumentsStore,
} from "@/app/store/documents-store";
import { isAdmin, useUserStore } from "@/app/store/user-store";

const ACCEPT = ".pdf,application/pdf,image/*";

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

function useSourceTitles(open: boolean, files: File[]) {
  const [titles, setTitles] = useState<Record<string, TitleEntry>>({});
  const abortByKey = useRef(new Map<string, AbortController>());
  const queue = useRef<File[]>([]);
  const active = useRef(0);
  const started = useRef(new Set<string>());
  const pump = useRef(() => {});

  pump.current = () => {
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
          pump.current();
        });
    }
  };

  const abortAll = () => {
    queue.current = [];
    active.current = 0;
    started.current.clear();
    for (const ac of abortByKey.current.values()) ac.abort();
    abortByKey.current.clear();
  };

  useEffect(() => {
    return () => abortAll();
  }, []);

  useEffect(() => {
    if (!open) {
      abortAll();
      setTitles({});
      return;
    }

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
    pump.current();
  }, [open, files]);

  return titles;
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
  matchTitle?: string
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

function useSourceInspect(open: boolean, files: File[]) {
  const [inspect, setInspect] = useState<Record<string, InspectEntry>>({});
  const abortByKey = useRef(new Map<string, AbortController>());
  const queue = useRef<File[]>([]);
  const active = useRef(0);
  const started = useRef(new Set<string>());
  const filesRef = useRef(files);
  filesRef.current = files;
  const pump = useRef(() => {});

  const applyIntra = (current: Record<string, InspectEntry>) => {
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
  };

  pump.current = () => {
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
                matchTitle: match?.title,
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
          pump.current();
        });
    }
  };

  const abortAll = () => {
    queue.current = [];
    active.current = 0;
    started.current.clear();
    for (const ac of abortByKey.current.values()) ac.abort();
    abortByKey.current.clear();
  };

  useEffect(() => {
    return () => abortAll();
  }, []);

  useEffect(() => {
    if (!open) {
      abortAll();
      setInspect({});
      return;
    }

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
    pump.current();
  }, [open, files]);

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
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
  inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[12px] font-medium text-muted">
        {label}
      </span>
      <input
        ref={inputRef}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="h-9 w-full rounded-xl border border-[var(--border)] bg-canvas px-3 text-[13px] text-ink outline-none placeholder:text-muted-soft focus:border-[var(--border-strong)]"
      />
    </label>
  );
}

type Props = {
  open: boolean
  onClose: () => void
};

export function AddDocumentDialog({ open, onClose }: Props) {
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
  const titles = useSourceTitles(open, files);
  const inspect = useSourceInspect(open, files);

  const reset = useCallback(() => {
    dragCount.current = 0;
    busy.current = false;
    erpTouched.current = false;
    const gen = ++erpGen.current;
    setClient("");
    setErp("");
    setAnzsco("");
    setTeam("");
    setMember(useUserStore.getState().name);
    setFiles([]);
    setOver(false);
    setErpError(false);
    setSubmitting(false);
    setNote("");
    void suggestErp().then((code) => {
      if (gen !== erpGen.current || erpTouched.current) return;
      setErp(code);
    });
  }, []);

  useEffect(() => {
    if (!open) {
      erpGen.current += 1;
      setFiles([]);
      return;
    }
    reset();
    useChromeStore.getState().setMenu(null);
    const frame = window.requestAnimationFrame(() => firstRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

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
  const needsReason =
    !admin &&
    files.some((file) => {
      const check = inspect[fileKey(file)];
      return Boolean(
        check &&
          !check.pending &&
          !check.failed &&
          check.uniqueness === "duplicate",
      );
    });

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
        if (!entry || entry.pending || !isPrintedTitle(entry.value)) return "";
        return entry.value;
      }),
      note: needsReason ? note.trim() : undefined,
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

  if (!open || typeof document === "undefined") return null;

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
          <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2">
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
            <div className="sm:col-span-2">
              <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2">
                <Field
                  label="ERP Code"
                  value={erp}
                  onChange={(value) => {
                    erpTouched.current = true;
                    setErp(value);
                    if (erpError) setErpError(false);
                  }}
                  placeholder="ERP-10001"
                />
                <AnzscoSelect value={anzsco} onChange={setAnzsco} />
              </div>
              <p
                className={`h-4 text-[11px] ${
                  erpError ? "text-red-600" : "text-transparent"
                }`}
              >
                ERP code is already in use
              </p>
            </div>
            <TeamSelect value={team} onChange={setTeam} />
            {admin ? (
              <Field
                label="Member"
                value={member}
                onChange={setMember}
                placeholder="Member"
              />
            ) : (
              <label className="block min-w-0">
                <span className="mb-1.5 block text-[12px] font-medium text-muted">
                  Member
                </span>
                <input
                  value={member}
                  readOnly
                  className="h-9 w-full rounded-xl border border-[var(--border)] bg-canvas px-3 text-[13px] text-ink outline-none"
                />
              </label>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex h-5 items-center justify-between">
              <p className="text-[12px] font-medium text-muted">Upload</p>
              <p className="text-[11px] tabular-nums text-muted-soft">
                {files.length} / {SOURCE_TOTAL}
              </p>
            </div>
            <div className="relative min-h-[11rem] overflow-hidden rounded-2xl border border-dashed border-[var(--border-strong)] bg-canvas">
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
                      const entry = titles[fileKey(file)];
                      const pending = entry?.pending ?? isPdfFile(file);
                      const title = pending
                        ? "Generating title…"
                        : entry?.value || "Untitled document";
                      const check = inspect[fileKey(file)];
                      const checking = !check || check.pending;
                      const failed = Boolean(check?.failed);
                      const uniqueMeta = uniquenessMeta(
                        check?.uniqueness === "duplicate" ? "duplicate" : "unique",
                      );
                      const matchLine = check?.intra
                        ? "Same file already in this upload"
                        : [check?.erp, check?.member, check?.client]
                            .filter((part) => part && part.trim())
                            .join(" · ");
                      const when =
                        check?.uploaded ? formatDateTime(check.uploaded) : "";
                      return (
                        <li
                          key={fileKey(file)}
                          className="flex min-h-12 items-start gap-2.5 px-3 py-2"
                        >
                          <FileText
                            className="mt-0.5 size-3.5 shrink-0 text-muted"
                            strokeWidth={1.75}
                            absoluteStrokeWidth
                          />
                          <div className="min-w-0 flex-1">
                            <DocTitle
                              value={title}
                              className={`pt-px text-[13px] ${
                                pending
                                  ? "title-pulse text-muted"
                                  : "text-ink"
                              }`}
                            />
                            <span className="mt-0.5 block truncate text-[11px] text-muted-soft">
                              {file.name}
                            </span>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {checking ? (
                                <span className="title-pulse text-[11px] text-muted">
                                  Checking uniqueness…
                                </span>
                              ) : failed ? (
                                <span className="text-[11px] text-muted">
                                  Couldn’t verify yet
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex h-5 items-center rounded-full px-1.5 text-[10px] font-medium ${uniqueMeta.className}`}
                                >
                                  {uniqueMeta.label}
                                </span>
                              )}
                            </div>
                            {!checking && !failed && check?.uniqueness === "duplicate" ? (
                              <p className="mt-1 text-[11px] leading-4 text-muted">
                                {matchLine || "Matches an existing source"}
                                {when ? ` · ${when}` : ""}
                                {check.matchTitle && !check.intra
                                  ? ` · ${check.matchTitle}`
                                  : ""}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove ${file.name}`}
                            onClick={() =>
                              setFiles((current) =>
                                current.filter((_, i) => i !== index),
                              )
                            }
                            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-muted outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                          >
                            <X className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
                          </button>
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

          {needsReason ? (
            <label className="mt-4 block min-w-0">
              <span className="mb-1.5 block text-[12px] font-medium text-muted">
                Reason for review
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, 500))}
                rows={3}
                maxLength={500}
                required
                placeholder="Why should this duplicate be kept?"
                className="min-h-[4.5rem] w-full resize-none rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-[13px] leading-5 text-ink outline-none placeholder:text-muted-soft focus:border-[var(--border-strong)]"
              />
              <span className="mt-1.5 block text-[11px] leading-4 text-muted-soft">
                An admin will see this with the pending files.
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
    </div>,
    document.body,
  );
}
