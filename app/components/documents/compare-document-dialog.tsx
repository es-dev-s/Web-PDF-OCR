"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { FileStage, PaneHead } from "@/app/components/documents/compare-view";
import { DuplicateNote } from "@/app/components/documents/duplicate-note";
import { SAME_ORIGIN_BACKEND } from "@/app/lib/backend";
import { useChromeStore } from "@/app/store/chrome-store";
import {
  useDocumentsStore,
  type DocumentItem,
  type DuplicateMatch,
} from "@/app/store/documents-store";

function builtFileUrl(documentId?: string, sourceId?: string) {
  if (!documentId || !sourceId) return "";
  return `${SAME_ORIGIN_BACKEND}/v1/documents/${documentId}/sources/${sourceId}/file`;
}

function norm(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function resolveMatchFile(
  match: DuplicateMatch,
  items: DocumentItem[],
  currentSourceId: string,
): { url: string; contentType?: string } {
  if (match.documentId && match.sourceId) {
    return {
      url: match.fileUrl || builtFileUrl(match.documentId, match.sourceId),
      contentType: match.contentType,
    };
  }
  if (match.sourceId) {
    for (const item of items) {
      const source = item.sources.find((row) => row.id === match.sourceId);
      if (!source) continue;
      return {
        url: source.fileUrl || builtFileUrl(item.id, source.id),
        contentType: source.contentType || match.contentType,
      };
    }
  }
  const erp = norm(match.erp);
  const title = norm(match.title);
  for (const item of items) {
    if (erp && norm(item.erp) !== erp) continue;
    for (const source of item.sources) {
      if (source.id === currentSourceId) continue;
      if (title && norm(source.title) !== title) continue;
      const url = source.fileUrl || builtFileUrl(item.id, source.id);
      if (url) return { url, contentType: source.contentType || match.contentType };
    }
  }
  return { url: match.fileUrl || "", contentType: match.contentType };
}

function DuplicateSwitcher({
  index,
  total,
  onPrev,
  onNext,
}: {
  index: number
  total: number
  onPrev: () => void
  onNext: () => void
}) {
  const atStart = index <= 0;
  const atEnd = index >= total - 1;
  return (
    <div className="flex items-center rounded-full bg-black/[0.04] p-0.5">
      <button
        type="button"
        aria-label="Previous duplicate"
        disabled={atStart}
        onClick={onPrev}
        className="flex size-7 items-center justify-center rounded-full text-muted outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-white hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronLeft className="size-4" strokeWidth={1.75} absoluteStrokeWidth />
      </button>
      <p className="min-w-[3.75rem] text-center text-[12px] tabular-nums text-ink">
        {index + 1} / {total}
      </p>
      <button
        type="button"
        aria-label="Next duplicate"
        disabled={atEnd}
        onClick={onNext}
        className="flex size-7 items-center justify-center rounded-full text-muted outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-white hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight className="size-4" strokeWidth={1.75} absoluteStrokeWidth />
      </button>
    </div>
  );
}

export function CompareDocumentDialog() {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pending = useDocumentsStore((s) => s.pendingCompare);
  const items = useDocumentsStore((s) => s.items);
  const item = useDocumentsStore((s) => {
    const id = s.pendingCompare?.docId;
    if (!id) return null;
    return s.items.find((row) => row.id === id) ?? null;
  });
  const source = item
    ? item.sources.find((row) => row.id === pending?.sourceId) ?? null
    : null;
  const closeCompare = useDocumentsStore((s) => s.closeCompare);
  const duplicates = source?.duplicates ?? [];
  const open = Boolean(pending && item && source);

  // The cursor belongs to one source. Keying it means switching sources, or
  // losing the duplicate it pointed at, falls back to the first entry without
  // an extra render pass.
  const compareKey = `${pending?.docId ?? ""}:${pending?.sourceId ?? ""}`;
  const [cursor, setCursor] = useState({ key: compareKey, index: 0 });
  const carried = cursor.key === compareKey ? cursor.index : 0;
  const index = carried < duplicates.length ? carried : 0;
  const setIndex = useCallback(
    (next: number | ((current: number) => number)) => {
      setCursor((prev) => {
        const current = prev.key === compareKey ? prev.index : 0;
        return {
          key: compareKey,
          index: typeof next === "function" ? next(current) : next,
        };
      });
    },
    [compareKey],
  );

  useEffect(() => {
    if (!open) return;
    useChromeStore.getState().setMenu(null);
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (pending && !source) closeCompare();
  }, [pending, source, closeCompare]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCompare();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setIndex((current) =>
          Math.min(Math.max(duplicates.length - 1, 0), current + 1),
        );
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
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeCompare, duplicates.length, setIndex]);

  if (!open || !item || !source || typeof document === "undefined") return null;

  const match = duplicates[index] ?? null;
  const resolved = match
    ? resolveMatchFile(match, items, source.id)
    : { url: "" };
  const solo = duplicates.length === 0;
  const heading = solo ? "View" : "Compare";

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2.5 sm:p-3.5">
      <button
        type="button"
        aria-label={solo ? "Close view" : "Close compare"}
        className="absolute inset-0 bg-black/28 backdrop-blur-[3px]"
        style={{ animation: "backdropIn 180ms var(--shell-ease) both" }}
        onClick={closeCompare}
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
            {heading}
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={closeCompare}
            className="flex size-8 items-center justify-center rounded-xl text-muted outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <X className="size-4" strokeWidth={1.75} absoluteStrokeWidth />
          </button>
        </div>

        <div
          className={`grid min-h-0 flex-1 grid-cols-1 ${
            solo
              ? ""
              : "divide-y divide-[var(--border)] lg:grid-cols-2 lg:divide-x lg:divide-y-0"
          }`}
        >
          <section className="flex min-h-0 flex-col">
            <PaneHead
              kicker={solo ? "File" : "This file"}
              title={source.title}
              detail={[item.client, source.uploaded].filter(Boolean).join(" · ")}
              uniqueness={source.uniqueness}
              trailing={
                source.uniqueness === "duplicate" ? (
                  <DuplicateNote note={source.note} who={item.member} compact />
                ) : undefined
              }
            />
            <div className="min-h-0 flex-1 bg-[var(--canvas)]">
              <FileStage
                key={source.fileUrl || builtFileUrl(item.id, source.id)}
                url={source.fileUrl || builtFileUrl(item.id, source.id)}
                contentType={source.contentType}
                label={source.title}
              />
            </div>
          </section>

          {solo ? null : (
          <section className="flex min-h-0 flex-col">
            {match ? (
              <>
                <PaneHead
                  kicker="Duplicate"
                  title={match.title}
                  detail={[match.client, match.erp, match.uploaded]
                    .filter((part) => part && String(part).trim())
                    .join(" · ")}
                  uniqueness={match.uniqueness}
                  trailing={
                    <span className="flex shrink-0 items-center gap-1">
                      {match.uniqueness === "duplicate" ? (
                        <DuplicateNote
                          note={match.note}
                          who={match.member}
                          compact
                        />
                      ) : null}
                      {duplicates.length > 0 ? (
                        <DuplicateSwitcher
                          index={index}
                          total={duplicates.length}
                          onPrev={() => setIndex((current) => Math.max(0, current - 1))}
                          onNext={() =>
                            setIndex((current) =>
                              Math.min(duplicates.length - 1, current + 1),
                            )
                          }
                        />
                      ) : null}
                    </span>
                  }
                />
                <div className="min-h-0 flex-1 bg-[var(--canvas)]">
                  <FileStage
                    key={resolved.url || match.id}
                    url={resolved.url}
                    contentType={resolved.contentType ?? match.contentType}
                    label={match.title}
                  />
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center px-8 text-center">
                <p className="max-w-[16rem] text-[13px] leading-5 text-muted">
                  This file has no duplicates to compare.
                </p>
              </div>
            )}
          </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
