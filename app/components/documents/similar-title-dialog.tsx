"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { FolderOpen, X } from "lucide-react";
import {
  alignedTitleWords,
  displayTitle,
  similarPercent,
  similarTitleParts,
  type TitlePart,
} from "@/app/lib/titles";
import { useChromeStore } from "@/app/store/chrome-store";
import {
  useDocumentsStore,
  type DocumentItem,
  type SourceFile,
  type TitleSimilarMatch,
} from "@/app/store/documents-store";

function metaLine(match: TitleSimilarMatch) {
  return [match.client, match.erp, match.member]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" · ");
}

function HighlightedTitle({
  parts,
  className,
}: {
  parts: TitlePart[]
  className: string
}) {
  return (
    <span className={`block min-w-0 wrap-anywhere break-words leading-snug ${className}`}>
      {parts.map((part, index) =>
        part.hit ? (
          <mark
            key={`${part.text}-${index}`}
            className="rounded-[3px] bg-[#ffe58a] px-0.5 text-ink"
          >
            {part.text}
          </mark>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        ),
      )}
    </span>
  );
}

function SimilarRow({
  original,
  match,
}: {
  original: string
  match: TitleSimilarMatch
}) {
  const pct = similarPercent(match.score);
  const words = alignedTitleWords(original, match.title);
  const detail = metaLine(match);
  return (
    <li className="flex items-start gap-3 border-t border-[var(--border)] px-5 py-3">
      <div className="min-w-0 flex-1">
        <HighlightedTitle
          parts={similarTitleParts(original, match.title)}
          className="text-[13px] font-medium tracking-[-0.01em] text-ink"
        />
        {detail ? (
          <p className="mt-0.5 truncate text-[12px] text-muted">{detail}</p>
        ) : null}
        <p className="mt-0.5 text-[11px] tabular-nums text-muted-soft">
          {words.total > 0
            ? `${words.matched} of ${words.total} words match · ${match.uploaded}`
            : match.uploaded}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="inline-flex h-[22px] min-w-[3.25rem] items-center justify-center rounded-full bg-[#fff3bf] px-2 text-[11px] font-medium tabular-nums text-[#8a6d00]">
          {pct}%
        </span>
        {match.fileUrl ? (
          <button
            type="button"
            aria-label={`Open ${match.title}`}
            title="Open file"
            onClick={() =>
              window.open(match.fileUrl, "_blank", "noopener,noreferrer")
            }
            className="flex size-7 items-center justify-center rounded-lg text-muted outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <FolderOpen className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
          </button>
        ) : null}
      </div>
    </li>
  );
}

function OriginalBlock({
  source,
  erp,
}: {
  source: SourceFile
  erp: string
}) {
  return (
    <div className="mx-5 rounded-xl bg-[#fff8db] px-3.5 py-3">
      <p className="text-[11px] font-medium tracking-[0.04em] text-[#8a6d00] uppercase">
        Original printed title
      </p>
      <p className="mt-1 text-[15px] font-semibold tracking-[-0.02em] wrap-anywhere break-words leading-snug text-ink">
        {displayTitle(source.title)}
      </p>
      <p className="mt-1 font-mono text-[12px] tabular-nums text-[#8a6d00]/80">
        {erp}
      </p>
    </div>
  );
}

function similarSources(item: DocumentItem): SourceFile[] {
  return item.sources.filter((source) => source.titleSimilar.length > 0);
}

function SimilarBody({ item }: { item: DocumentItem }) {
  const groups = similarSources(item);
  return (
    <div className="flex flex-col gap-4">
      {groups.map((source) => (
        <section key={source.id}>
          <OriginalBlock source={source} erp={item.erp} />
          <p className="px-5 pb-1 pt-3 text-[11px] font-medium tracking-[0.04em] text-muted uppercase">
            Similar titles
          </p>
          <ul>
            {source.titleSimilar.map((match) => (
              <SimilarRow
                key={match.id}
                original={source.title}
                match={match}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function SimilarTitleDialog() {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const pendingSimilarId = useDocumentsStore((s) => s.pendingSimilarId);
  const item = useDocumentsStore((s) => {
    const id = s.pendingSimilarId;
    if (!id) return null;
    return s.items.find((row) => row.id === id) ?? null;
  });
  const closeSimilar = useDocumentsStore((s) => s.closeSimilar);
  const groups = item ? similarSources(item) : [];
  const open = Boolean(pendingSimilarId && item && groups.length > 0);

  useEffect(() => {
    if (!open) return;
    useChromeStore.getState().setMenu(null);
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (pendingSimilarId && (!item || similarSources(item).length === 0)) {
      closeSimilar();
    }
  }, [pendingSimilarId, item, closeSimilar]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSimilar();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeSimilar]);

  if (!open || !item || typeof document === "undefined") return null;

  const count = groups.reduce(
    (sum, source) => sum + source.titleSimilar.length,
    0,
  );
  const heading =
    count === 1 ? "1 similar title" : `${count} similar titles`;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/20"
        style={{ animation: "backdropIn 160ms var(--shell-ease) both" }}
        onClick={closeSimilar}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] flex w-full max-w-[min(38rem,calc(100vw-2rem))] max-h-[min(44rem,calc(100vh-2rem))] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-[var(--shadow-elevated)]"
        style={{ animation: "popoverIn 180ms var(--shell-ease) both" }}
      >
        <div className="flex h-12 shrink-0 items-center justify-between px-5">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-[15px] font-semibold tracking-[-0.02em] text-ink"
            >
              {heading}
            </h2>
            <p className="text-[11px] text-muted">
              90% of words match the original printed title
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={closeSimilar}
            className="flex size-7 items-center justify-center rounded-lg text-muted outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <X className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
          </button>
        </div>
        <div className="h-px bg-[var(--border)]" />
        <div className="shell-scroll min-h-0 flex-1 overflow-y-auto py-4">
          <SimilarBody item={item} />
        </div>
        <div className="h-px bg-[var(--border)]" />
        <div className="flex h-14 shrink-0 items-center justify-end px-5">
          <button
            type="button"
            onClick={closeSimilar}
            className="inline-flex h-8 items-center rounded-xl px-3 text-[13px] font-medium text-muted outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
