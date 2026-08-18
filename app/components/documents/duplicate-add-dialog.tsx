"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, X } from "lucide-react";
import { IncomingDuplicateNote, MatchLine, matchFactsLabel, mergeNotes } from "@/app/components/documents/duplicate-note";
import { PreUploadCompare } from "@/app/components/documents/pre-upload-compare";
import { inspectMatchUrl, type InspectMatch, type InspectResult } from "@/app/lib/api";
import { formatDateTime } from "@/app/lib/dates";
import { uniquenessMeta } from "@/app/lib/files";
import { useDocumentsStore, type PendingSourceAdd } from "@/app/store/documents-store";
import { useUserStore } from "@/app/store/user-store";

function existingMatchNote(result: InspectResult, match: InspectMatch) {
  return {
    note: mergeNotes(match.note, ...result.matches.map((row) => row.note)),
    who: match.member,
  };
}

const FILE_PILL =
  "inline-flex h-5 w-[4.75rem] shrink-0 items-center justify-center rounded-full text-[10px] font-medium";

function IncomingFile({
  file,
  result,
  reason,
  onReason,
  required,
  onCompare,
}: {
  file: File
  result: InspectResult
  reason: string
  onReason: (next: string) => void
  required: boolean
  onCompare?: () => void
}) {
  const match = result.matches[0];
  const kept = match ? existingMatchNote(result, match) : undefined;
  const uniqueMeta = uniquenessMeta("duplicate");
  return (
    <li className="grid grid-cols-[1.125rem_minmax(0,1fr)_auto] items-start gap-x-2.5 border-t border-[var(--border)] px-3 py-2.5 first:border-t-0">
      <FileText
        className="mt-[3px] size-3.5 shrink-0 text-muted"
        strokeWidth={1.75}
        absoluteStrokeWidth
      />
      <div className="min-w-0">
        <p className="truncate text-[13px] text-ink">{file.name}</p>
      </div>
      <span className="mt-0.5 flex shrink-0 items-center gap-0.5">
        <span className={`${FILE_PILL} ${uniqueMeta.className}`}>
          {uniqueMeta.label}
        </span>
        <IncomingDuplicateNote
          value={reason}
          onChange={onReason}
          required={required}
          past={kept?.note}
        />
      </span>
      {match ? (
        <div className="col-span-2 col-start-2 min-w-0">
          <MatchLine
            match={match}
            note={kept?.note}
            who={kept?.who}
            onCompare={onCompare}
          />
        </div>
      ) : (
        <p className="col-span-2 col-start-2 mt-1 min-w-0 truncate text-[11px] leading-4 text-muted">
          Same file as another in this upload.
        </p>
      )}
    </li>
  );
}

export function DuplicateAddDialog() {
  const pending = useDocumentsStore((s) => s.pendingSourceAdd);
  if (!pending || pending.files.length === 0) return null;
  return <DuplicateAddPanel pending={pending} />;
}

function DuplicateAddPanel({ pending }: { pending: PendingSourceAdd }) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmPendingAdd = useDocumentsStore((s) => s.confirmPendingAdd);
  const cancelPendingAdd = useDocumentsStore((s) => s.cancelPendingAdd);
  const role = useUserStore((s) => s.role);
  const member = role === "member";
  const [notes, setNotes] = useState<string[]>(() => pending.files.map(() => ""));
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [compareIndex, setCompareIndex] = useState(-1);
  const comparing =
    compareIndex >= 0 ? pending.files[compareIndex] ?? null : null;
  const compareMatch = comparing
    ? pending.results[compareIndex]?.matches[0]
    : undefined;
  const compareKept =
    comparing && compareMatch
      ? existingMatchNote(
          pending.results[compareIndex] ?? {
            ok: true,
            uniqueness: "duplicate",
            matches: [],
          },
          compareMatch,
        )
      : undefined;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => cancelRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      cancelPendingAdd();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cancelPendingAdd]);

  if (typeof document === "undefined") return null;

  const missingReason = member && notes.some((value) => value.trim().length === 0);
  const count = pending.files.length;
  const heading = count === 1 ? "This file is a duplicate" : "These files are duplicates";

  const dialog = createPortal(
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
            {member
              ? "It matches an existing source. Request admin review to keep it. Until then it stays pending and only you and admins can see it."
              : "It matches an existing source. You can still add it — it will be saved as a duplicate."}
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-canvas">
            <ul>
              {pending.files.map((file, index) => (
                <IncomingFile
                  key={`${file.name}:${file.size}:${file.lastModified}:${index}`}
                  file={file}
                  result={pending.results[index] ?? { ok: true, uniqueness: "duplicate", matches: [] }}
                  reason={notes[index] ?? ""}
                  required={member}
                  onReason={(next) =>
                    setNotes((current) => {
                      const copy = current.slice();
                      copy[index] = next;
                      return copy;
                    })
                  }
                  onCompare={
                    pending.results[index]?.matches[0]
                      ? () => setCompareIndex(index)
                      : undefined
                  }
                />
              ))}
            </ul>
          </div>
        </div>
        <div className="h-px bg-[var(--border)]" />
        <div className="flex h-14 shrink-0 items-center justify-end gap-2 px-5">
          {submitError ? (
            <p className="mr-auto min-w-0 truncate text-[12px] text-red-600" title={submitError}>
              {submitError}
            </p>
          ) : null}
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
            disabled={busy || missingReason}
            onClick={() => {
              if (busy) return;
              if (missingReason) return;
              setBusy(true);
              setSubmitError("");
              void confirmPendingAdd(notes.map((value) => value.trim()))
                .then((result) => {
                  if (result && !result.ok) {
                    setSubmitError(
                      result.message || "Couldn’t add those files. Try again.",
                    );
                  }
                })
                .finally(() => {
                  setBusy(false);
                });
            }}
            className="inline-flex h-8 min-w-[7.5rem] items-center justify-center rounded-xl bg-ink px-4 text-[13px] font-medium tracking-[-0.015em] text-white outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:bg-ink/30 disabled:hover:bg-ink/30"
          >
            {member ? "Request review" : `Add ${count === 1 ? "file" : "files"}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      {dialog}
      {comparing && compareMatch ? (
        <PreUploadCompare
          file={comparing}
          incomingTitle={comparing.name}
          matchTitle={compareMatch.title || ""}
          matchFacts={[
            matchFactsLabel(compareMatch),
            compareMatch.uploaded_at ? formatDateTime(compareMatch.uploaded_at) : "",
          ]
            .filter((part) => part && String(part).trim())
            .join(" · ")}
          matchUrl={inspectMatchUrl(compareMatch)}
          matchUniqueness={compareMatch.uniqueness}
          matchNote={compareKept?.note}
          matchWho={compareKept?.who}
          onClose={() => setCompareIndex(-1)}
        />
      ) : null}
    </>
  );
}
