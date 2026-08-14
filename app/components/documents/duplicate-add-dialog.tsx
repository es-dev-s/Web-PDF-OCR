"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { FileText, X } from "lucide-react";
import { DocTitle } from "@/app/components/documents/doc-title";
import type { InspectMatch, InspectResult } from "@/app/lib/api";
import { formatDateTime } from "@/app/lib/dates";
import { useDocumentsStore } from "@/app/store/documents-store";

function display(value: string | undefined) {
  const next = value?.trim() ?? "";
  return next.length > 0 ? next : "—";
}

export function MatchFacts({ match }: { match: InspectMatch }) {
  const who = [match.member, match.client].filter((part) => part?.trim()).join(" · ");
  const when = match.uploaded_at ? formatDateTime(match.uploaded_at) : "";
  return (
    <div className="min-w-0">
      <DocTitle
        value={display(match.title)}
        className="text-[13px] font-medium tracking-[-0.01em] text-ink"
      />
      <p className="mt-0.5 font-mono text-[12px] tabular-nums text-ink">
        {display(match.erp)}
      </p>
      <p className="mt-0.5 text-[12px] text-muted">{who || "—"}</p>
      {when || Number.isFinite(match.score) ? (
        <p className="mt-1 text-[11px] tabular-nums text-muted-soft">
          {[when, Number.isFinite(match.score) ? match.score.toFixed(1) : ""]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function IncomingFile({
  file,
  result,
}: {
  file: File
  result: InspectResult
}) {
  const match = result.matches[0];
  return (
    <li className="border-t border-[var(--border)] first:border-t-0">
      <div className="flex items-start gap-3 px-4 py-3">
        <FileText
          className="mt-0.5 size-3.5 shrink-0 text-muted"
          strokeWidth={1.75}
          absoluteStrokeWidth
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-[0.04em] text-muted-soft uppercase">
            Incoming file
          </p>
          <p className="mt-1 truncate text-[13px] text-ink">{file.name}</p>
          {match ? (
            <div className="mt-3 rounded-xl bg-surface px-3 py-2.5">
              <p className="text-[11px] font-medium tracking-[0.04em] text-muted-soft uppercase">
                Duplicate of
              </p>
              <div className="mt-1.5">
                <MatchFacts match={match} />
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-muted">
              Same file as another in this upload.
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

export function DuplicateAddDialog() {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const pending = useDocumentsStore((s) => s.pendingSourceAdd);
  const confirmPendingAdd = useDocumentsStore((s) => s.confirmPendingAdd);
  const cancelPendingAdd = useDocumentsStore((s) => s.cancelPendingAdd);
  const open = Boolean(pending && pending.files.length > 0);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => cancelRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelPendingAdd();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, cancelPendingAdd]);

  if (!open || !pending || typeof document === "undefined") return null;

  const count = pending.files.length;
  const heading = count === 1 ? "This file is a duplicate" : "These files are duplicates";

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        className="absolute inset-0 bg-black/20"
        style={{ animation: "backdropIn 160ms var(--shell-ease) both" }}
        onClick={cancelPendingAdd}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] flex w-full max-w-[min(28rem,calc(100vw-2rem))] max-h-[min(36rem,calc(100vh-2rem))] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-[var(--shadow-elevated)]"
        style={{ animation: "popoverIn 180ms var(--shell-ease) both" }}
      >
        <div className="flex h-12 shrink-0 items-center justify-between px-5">
          <h2
            id={titleId}
            className="text-[15px] font-semibold tracking-[-0.02em] text-ink"
          >
            {heading}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={cancelPendingAdd}
            className="flex size-7 items-center justify-center rounded-lg text-muted outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <X className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
          </button>
        </div>
        <div className="h-px bg-[var(--border)]" />
        <div className="shell-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[13px] leading-5 text-muted">
            It matches an existing source. You can still add it — it will be saved as a duplicate.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-canvas">
            <ul>
              {pending.files.map((file, index) => (
                <IncomingFile
                  key={`${file.name}:${file.size}:${file.lastModified}:${index}`}
                  file={file}
                  result={pending.results[index] ?? { ok: true, uniqueness: "duplicate", matches: [] }}
                />
              ))}
            </ul>
          </div>
        </div>
        <div className="h-px bg-[var(--border)]" />
        <div className="flex h-14 shrink-0 items-center justify-end gap-2 px-5">
          <button
            ref={cancelRef}
            type="button"
            onClick={cancelPendingAdd}
            className="inline-flex h-8 items-center rounded-xl px-3 text-[13px] font-medium text-muted outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void confirmPendingAdd();
            }}
            className="inline-flex h-8 min-w-[7.5rem] items-center justify-center rounded-xl bg-ink px-4 text-[13px] font-medium tracking-[-0.015em] text-white outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            Add {count === 1 ? "file" : "files"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
