"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { FileStage, PaneHead } from "@/app/components/documents/compare-view";
import { DuplicateNote } from "@/app/components/documents/duplicate-note";
import type { SourceUniqueness } from "@/app/lib/files";

type Props = {
  file: File
  incomingTitle: string
  matchTitle: string
  matchFacts: string
  matchUrl: string
  matchUniqueness?: SourceUniqueness
  matchNote?: string
  matchWho?: string
  onClose: () => void
};

/**
 * Same compare chrome as the in-app module. The left pane is the local file
 * that has not been stored yet; the right pane is the match already on disk.
 */
export function PreUploadCompare({
  file,
  incomingTitle,
  matchTitle,
  matchFacts,
  matchUrl,
  matchUniqueness = "original",
  matchNote,
  matchWho,
  onClose,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [localUrl, setLocalUrl] = useState("");

  useEffect(() => {
    const next = URL.createObjectURL(file);
    const id = window.setTimeout(() => setLocalUrl(next), 0);
    return () => {
      window.clearTimeout(id);
      URL.revokeObjectURL(next);
    };
  }, [file]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const nodes = panelRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href]",
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      window.cancelAnimationFrame(frame);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const thisTitle = incomingTitle.trim() || file.name;
  const thatTitle = matchTitle.trim() || "Stored file";

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-2.5 sm:p-3.5">
      <button
        type="button"
        aria-label="Close compare"
        className="absolute inset-0 bg-black/28 backdrop-blur-[3px]"
        style={{ animation: "backdropIn 180ms var(--shell-ease) both" }}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] flex h-[calc(100dvh-1.25rem)] w-[calc(100vw-1.25rem)] max-w-[96rem] flex-col overflow-hidden rounded-[24px] border border-[var(--border)] bg-surface shadow-[var(--shadow-elevated)]"
        style={{ animation: "popoverIn 200ms var(--shell-ease) both" }}
      >
        <div className="flex h-12 shrink-0 items-center justify-between gap-4 px-5">
          <h2
            id={titleId}
            className="text-[15px] font-semibold tracking-[-0.02em] text-ink"
          >
            Compare
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl text-muted outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <X className="size-4" strokeWidth={1.75} absoluteStrokeWidth />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-[var(--border)] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <section className="flex min-h-0 flex-col">
            <PaneHead
              kicker="This file"
              title={thisTitle}
              detail={file.name}
              uniqueness="duplicate"
            />
            <div className="min-h-0 flex-1 bg-[var(--canvas)]">
              {localUrl ? (
                <FileStage
                  key={localUrl}
                  url={localUrl}
                  contentType={file.type || "application/pdf"}
                  label={thisTitle}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-[13px] text-muted-soft">Loading preview</p>
                </div>
              )}
            </div>
          </section>
          <section className="flex min-h-0 flex-col">
            <PaneHead
              kicker="Duplicate"
              title={thatTitle}
              detail={matchFacts}
              uniqueness={matchUniqueness}
              trailing={
                <DuplicateNote
                  note={matchNote}
                  who={matchWho}
                  compact
                  emptyText="No saved reason for this existing match."
                />
              }
            />
            <div className="min-h-0 flex-1 bg-[var(--canvas)]">
              <FileStage
                key={matchUrl || "missing"}
                url={matchUrl}
                contentType="application/pdf"
                label={thatTitle}
              />
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
