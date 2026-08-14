"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useChromeStore } from "@/app/store/chrome-store";
import { useDocumentsStore } from "@/app/store/documents-store";

export function DeleteDocumentDialog() {
  const titleId = useId();
  const detailId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pendingDeleteId = useDocumentsStore((s) => s.pendingDeleteId);
  const item = useDocumentsStore((s) => {
    const id = s.pendingDeleteId;
    if (!id) return null;
    return s.items.find((row) => row.id === id) ?? null;
  });
  const cancelRemove = useDocumentsStore((s) => s.cancelRemove);
  const confirmRemove = useDocumentsStore((s) => s.confirmRemove);
  const open = Boolean(pendingDeleteId && item);

  useEffect(() => {
    if (!open) return;
    useChromeStore.getState().setMenu(null);
    const frame = window.requestAnimationFrame(() => cancelRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (pendingDeleteId && !item) cancelRemove();
  }, [pendingDeleteId, item, cancelRemove]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelRemove();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const nodes = panelRef.current.querySelectorAll<HTMLButtonElement>(
        "button:not([disabled])",
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
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, cancelRemove]);

  if (!open || !item || typeof document === "undefined") return null;

  const files = item.sources.length;
  const fileLabel = files === 1 ? "1 source file" : `${files} source files`;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel delete"
        className="absolute inset-0 bg-black/20"
        style={{ animation: "backdropIn 160ms var(--shell-ease) both" }}
        onClick={cancelRemove}
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={detailId}
        className="relative z-[1] w-full max-w-[22.5rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-[var(--shadow-elevated)]"
        style={{ animation: "popoverIn 180ms var(--shell-ease) both" }}
      >
        <div className="px-5 pt-5 pb-4">
          <h2
            id={titleId}
            className="text-[15px] font-semibold tracking-[-0.02em] text-ink"
          >
            Delete this document?
          </h2>
          <p
            id={detailId}
            className="mt-2 text-[13px] leading-5 text-muted"
          >
            <span className="font-mono tabular-nums text-ink">{item.erp}</span>
            {item.client ? ` · ${item.client}` : ""}
            {" will be removed with "}
            {fileLabel}. This can’t be undone.
          </p>
        </div>
        <div className="h-px bg-[var(--border)]" />
        <div className="flex h-14 items-center justify-end gap-2 px-5">
          <button
            ref={cancelRef}
            type="button"
            onClick={cancelRemove}
            className="inline-flex h-8 items-center rounded-xl px-3 text-[13px] font-medium text-muted outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void confirmRemove();
            }}
            className="inline-flex h-8 min-w-[5.75rem] items-center justify-center rounded-xl bg-[#ff3b30] px-4 text-[13px] font-medium tracking-[-0.015em] text-white outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-[#e0352c] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
