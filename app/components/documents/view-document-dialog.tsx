"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { FolderOpen, X } from "lucide-react";
import { DocumentDetail } from "@/app/components/documents/document-detail";
import { useChromeStore } from "@/app/store/chrome-store";
import { useDocumentsStore, type DocumentItem } from "@/app/store/documents-store";

function ViewBody({ item }: { item: DocumentItem }) {
  const beginAddSources = useDocumentsStore((s) => s.beginAddSources);
  const adding = useDocumentsStore(
    (s) => s.addingToId !== null || s.pendingSourceAdd !== null,
  );
  return (
    <DocumentDetail
      item={item}
      adding={adding}
      onAdd={(files) => {
        void beginAddSources(item.id, files);
      }}
    />
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

  const fileHref = item.fileUrl;

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
          {fileHref ? (
            <button
              type="button"
              onClick={() => window.open(fileHref, "_blank", "noopener,noreferrer")}
              className="inline-flex h-8 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-xl bg-ink px-4 text-[13px] font-medium tracking-[-0.015em] text-white outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <FolderOpen className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
              Open file
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
