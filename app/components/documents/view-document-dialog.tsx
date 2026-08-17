"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { FileText, FolderOpen, Plus, X } from "lucide-react";
import { DocTitle } from "@/app/components/documents/doc-title";
import { DuplicateNote } from "@/app/components/documents/duplicate-note";
import { findAnzsco, formatAnzsco } from "@/app/lib/anzsco";
import { formatDateTime } from "@/app/lib/dates";
import {
  SOURCE_TOTAL,
  fileKind,
  formatBytes,
  isHashPending,
  statusMeta,
  uniquenessMeta,
} from "@/app/lib/files";
import { useChromeStore } from "@/app/store/chrome-store";
import {
  useDocumentsStore,
  type DocumentItem,
  type SourceFile,
} from "@/app/store/documents-store";

function display(value: string | undefined) {
  const next = value?.trim() ?? "";
  return next.length > 0 ? next : "—";
}

function Fact({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium tracking-[0.04em] text-muted-soft uppercase">
        {label}
      </p>
      <p className="mt-1 text-[13px] leading-5 tracking-[-0.01em] wrap-anywhere text-ink">
        {value}
      </p>
      {detail ? (
        <p className="mt-0.5 font-mono text-[12px] tabular-nums text-muted">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function SourceCard({
  source,
  client,
  member,
  pendingHash,
}: {
  source: SourceFile
  client: string
  member: string
  pendingHash: boolean
}) {
  const kind = fileKind(source.contentType);
  const size =
    typeof source.sizeBytes === "number" ? formatBytes(source.sizeBytes) : null;
  const unique = pendingHash
    ? { label: "Checking" }
    : uniquenessMeta(source.uniqueness);
  const meta = [
    kind,
    size,
    client.trim() || null,
    unique.label,
    source.score !== null ? source.score.toFixed(1) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="border-t border-[var(--border)] first:border-t-0">
      <div className="flex items-start gap-3 px-4 py-3">
        <FileText
          className="mt-0.5 size-3.5 shrink-0 text-muted"
          strokeWidth={1.75}
          absoluteStrokeWidth
        />
        <div className="min-w-0 flex-1">
          <DocTitle
            value={source.title}
            className="text-[13px] font-medium tracking-[-0.01em] text-ink"
          />
          <p className="mt-0.5 text-[11px] text-muted-soft">{meta}</p>
          <p className="mt-0.5 text-[11px] tabular-nums text-muted">
            {source.uploaded}
          </p>
        </div>
        {source.uniqueness === "duplicate" ? (
          <div className="mt-0.5 shrink-0">
            <DuplicateNote note={source.note} who={member} />
          </div>
        ) : null}
        {source.fileUrl ? (
          <button
            type="button"
            aria-label={`Open ${source.title}`}
            title="Open file"
            onClick={() =>
              window.open(source.fileUrl, "_blank", "noopener,noreferrer")
            }
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-muted outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <FolderOpen className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
          </button>
        ) : null}
      </div>
      {source.duplicates.length > 0 ? (
        <ul className="pb-3 pl-11 pr-4">
          {source.duplicates.map((match) => {
            const matchMeta = uniquenessMeta(match.uniqueness);
            return (
              <li key={match.id} className="flex items-baseline gap-2 py-1">
                <div className="min-w-0 flex-1">
                  <DocTitle
                    value={match.title}
                    className="text-[12px] text-muted"
                  />
                  <p className="mt-0.5 truncate text-[11px] text-muted-soft">
                    {[match.client, match.erp, match.member]
                      .filter((part) => part && part.trim())
                      .join(" · ")}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  <span
                    className={`inline-flex h-5 shrink-0 items-center rounded-full px-1.5 text-[10px] font-medium ${matchMeta.className}`}
                  >
                    {matchMeta.label}
                  </span>
                  {match.uniqueness === "duplicate" ? (
                    <DuplicateNote note={match.note} who={match.member} compact />
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

function ViewBody({ item }: { item: DocumentItem }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const beginAddSources = useDocumentsStore((s) => s.beginAddSources);
  const adding = useDocumentsStore(
    (s) => s.addingToId !== null || s.pendingSourceAdd !== null,
  );
  const canAdd = item.sources.length < SOURCE_TOTAL && !adding;
  const status = statusMeta(item.status);
  const uploaded = item.uploadedAt
    ? formatDateTime(item.uploadedAt) || item.uploaded
    : item.uploaded;
  const heading = item.title || item.sources[0]?.title || item.client || "Document";
  const anzsco = findAnzsco(item.anzsco);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <DocTitle
            value={heading}
            className="text-[15px] font-semibold tracking-[-0.02em] text-ink"
          />
          <p className="mt-1 font-mono text-[12px] tabular-nums text-muted">
            {item.erp}
          </p>
        </div>
        <span
          className={`inline-flex h-[22px] shrink-0 items-center rounded-full px-2 text-[11px] font-medium ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <Fact label="Client" value={display(item.client)} />
        <Fact label="User" value={display(item.member || item.uploader)} />
        <Fact label="ERP" value={display(item.erp)} />
        <Fact
          label="ANZSCO"
          value={anzsco?.title || display(formatAnzsco(item.anzsco))}
          detail={anzsco?.code}
        />
        <Fact label="Team" value={display(item.team)} />
        <Fact label="Uploaded" value={display(uploaded)} />
      </div>

      <div className="mt-6">
        <div className="mb-1.5 flex h-5 items-center justify-between">
          <p className="text-[12px] font-medium text-muted">Files</p>
          <p className="text-[11px] tabular-nums text-muted-soft">
            {item.sources.length} / {SOURCE_TOTAL}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf,image/*"
          multiple
          hidden
          onChange={(event) => {
            const list = event.target.files;
            if (list && list.length > 0) {
              void beginAddSources(item.id, Array.from(list));
            }
            event.target.value = "";
          }}
        />
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-canvas">
          {item.sources.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted">
              No files on this document.
            </p>
          ) : (
            <ul>
              {item.sources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  client={item.client}
                  member={item.member || item.uploader}
                  pendingHash={isHashPending(item.status, source)}
                />
              ))}
            </ul>
          )}
          {canAdd ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-10 w-full items-center gap-2 border-t border-[var(--border)] px-4 text-left text-[12px] font-medium text-muted outline-none hover:text-ink focus-visible:text-ink"
            >
              <Plus className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
              {adding ? "Checking uniqueness…" : "Add file"}
            </button>
          ) : adding ? (
            <p className="border-t border-[var(--border)] px-4 py-2.5 text-[12px] text-muted">
              Checking uniqueness…
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function ViewDocumentDialog() {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const pendingViewId = useDocumentsStore((s) => s.pendingViewId);
  const item = useDocumentsStore((s) => {
    const id = s.pendingViewId;
    if (!id) return null;
    return s.items.find((row) => row.id === id) ?? null;
  });
  const closeView = useDocumentsStore((s) => s.closeView);
  const open = Boolean(pendingViewId && item);

  useEffect(() => {
    if (!open) return;
    useChromeStore.getState().setMenu(null);
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (pendingViewId && !item) closeView();
  }, [pendingViewId, item, closeView]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeView();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeView]);

  if (!open || !item || typeof document === "undefined") return null;

  const fileHref = item.fileUrl ?? item.url;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/20"
        style={{ animation: "backdropIn 160ms var(--shell-ease) both" }}
        onClick={closeView}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] flex w-full max-w-[min(32rem,calc(100vw-2rem))] max-h-[min(40rem,calc(100vh-2rem))] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-[var(--shadow-elevated)]"
        style={{ animation: "popoverIn 180ms var(--shell-ease) both" }}
      >
        <div className="flex h-12 shrink-0 items-center justify-between px-5">
          <h2
            id={titleId}
            className="text-[15px] font-semibold tracking-[-0.02em] text-ink"
          >
            Details
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={closeView}
            className="flex size-7 items-center justify-center rounded-lg text-muted outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <X className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
          </button>
        </div>
        <div className="h-px bg-[var(--border)]" />
        <div className="shell-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ViewBody item={item} />
        </div>
        <div className="h-px bg-[var(--border)]" />
        <div className="flex h-14 shrink-0 items-center justify-end gap-2 px-5">
          <button
            type="button"
            onClick={closeView}
            className="inline-flex h-8 items-center rounded-xl px-3 text-[13px] font-medium text-muted outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => window.open(fileHref, "_blank", "noopener,noreferrer")}
            className="inline-flex h-8 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-xl bg-ink px-4 text-[13px] font-medium tracking-[-0.015em] text-white outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <FolderOpen className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
            Open file
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
