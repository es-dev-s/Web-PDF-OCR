"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Eye, GitCompare, RotateCw, ScanSearch, Search } from "lucide-react";
import { CompareDocumentDialog } from "@/app/components/documents/compare-document-dialog";
import { DuplicateNote, distinctNote, noteLines } from "@/app/components/documents/duplicate-note";
import { IconBtn } from "@/app/components/documents/icon-btn";
import { ViewDocumentDialog } from "@/app/components/documents/view-document-dialog";
import { formatDateTime } from "@/app/lib/dates";
import { statusMeta } from "@/app/lib/files";
import { useAccordionHold } from "@/app/hooks/use-accordion-hold";
import { useVirtualWindow } from "@/app/hooks/use-virtual-window";
import { approveReview, rejectReview } from "@/app/lib/api";
import {
  mapDocument,
  useDocumentsStore,
  type DocumentItem,
  type DuplicateMatch,
  type SourceFile,
} from "@/app/store/documents-store";
import { isAdmin, useUserStore } from "@/app/store/user-store";

const COLS =
  "grid-cols-[minmax(8rem,1.05fr)_minmax(7rem,1.05fr)_minmax(6.75rem,0.7fr)_minmax(6rem,0.85fr)_minmax(7rem,0.95fr)_8.25rem_11.25rem]";

const TITLE_COLS =
  "grid-cols-[minmax(0,1.35fr)_minmax(0,1.35fr)_minmax(0,0.95fr)_5.75rem]";

const HEADER_CELL =
  "flex h-8 min-w-0 items-center text-[11px] font-medium tracking-[0.05em] text-muted uppercase";

const ROW_CELL = "flex min-h-11 min-w-0 items-center py-1.5";

const TITLE_CELL = "flex min-h-10 min-w-0 items-center py-1.5";

export function ReviewWorkspace() {
  const router = useRouter();
  const role = useUserStore((s) => s.role);
  const upsert = useDocumentsStore((s) => s.upsert);
  const dropLocal = useDocumentsStore((s) => s.dropLocal);
  const refresh = useDocumentsStore((s) => s.refresh);
  const items = useDocumentsStore((s) => s.items);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [decline, setDecline] = useState<DocumentItem | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const loadGen = useRef(0);

  useEffect(() => {
    if (role && !isAdmin(role)) router.replace("/documents");
  }, [role, router]);

  useEffect(() => {
    if (!isAdmin(role)) return;
    const gen = ++loadGen.current;
    void refresh().finally(() => {
      if (gen === loadGen.current) setLoading(false);
    });
    return () => {
      loadGen.current += 1;
    };
  }, [role, refresh]);

  const pending = useMemo(() => {
    const rows = items.filter((item) => item.status === "pending_review");
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((item) => {
      const hay = [item.title, item.erp, item.member, item.client, item.team, item.uploader]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  const openId = pending.some((item) => item.id === expandedId) ? expandedId : null;
  const declineItem =
    decline && pending.some((item) => item.id === decline.id) ? decline : null;

  const estimate = useCallback(
    (index: number) => {
      const item = pending[index];
      if (!item) return 45;
      if (item.id !== expandedId) return 45;
      const sources = reviewSources(item);
      let extra = 48;
      for (const source of sources) {
        extra += Math.max(1, source.duplicates.length) * 40;
        extra += 36 + Math.max(1, noteLines(source.note).length) * 22;
      }
      if (item.reviewRequestedAt) extra += 24;
      return 45 + extra;
    },
    [pending, expandedId],
  );
  const virtual = useVirtualWindow(
    pending.length,
    estimate,
    14,
    expandedId ?? "",
  );

  if (!isAdmin(role)) {
    return (
      <div className="flex min-h-full min-w-0 items-center justify-center text-[13px] text-muted">
        {role ? "Redirecting…" : "Loading…"}
      </div>
    );
  }

  const onApprove = async (item: DocumentItem) => {
    if (busyId) return;
    setBusyId(item.id);
    setActionError("");
    try {
      upsert(mapDocument(await approveReview(item.id)));
    } catch {
      setActionError("Could not approve this duplicate. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async (item: DocumentItem) => {
    if (busyId) return;
    setBusyId(item.id);
    setActionError("");
    try {
      await rejectReview(item.id);
      dropLocal(item.id);
      setDecline(null);
    } catch {
      setActionError("Could not decline this duplicate. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const reload = () => {
    const gen = ++loadGen.current;
    setLoading(true);
    void refresh().finally(() => {
      if (gen === loadGen.current) setLoading(false);
    });
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="z-10 flex h-[var(--toolbar-h)] shrink-0 items-center gap-3 overflow-hidden border-b border-[var(--border)] bg-surface px-4 [contain:layout]">
        <label className="relative block min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-soft"
            strokeWidth={1.75}
            absoluteStrokeWidth
          />
          <input
            type="text"
            inputMode="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            autoComplete="off"
            spellCheck={false}
            className="h-8 w-full rounded-xl border border-[var(--border)] bg-canvas pr-3 pl-8 text-[13px] text-ink outline-none placeholder:text-muted-soft focus:border-[var(--border-strong)]"
          />
        </label>
        <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          <span className="inline-flex h-8 w-[7.5rem] shrink-0 items-center text-[12px] leading-none tabular-nums text-muted">
            {pending.length} {pending.length === 1 ? "row" : "rows"}
          </span>
          {actionError ? (
            <span className="max-w-[16rem] truncate text-[12px] text-muted" title={actionError}>
              {actionError}
            </span>
          ) : null}
          <button
            type="button"
            aria-label="Reload"
            title="Reload"
            onClick={reload}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <span className={`flex size-3.5 items-center justify-center ${loading ? "reload-spin" : ""}`}>
              <RotateCw className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
            </span>
          </button>
        </div>
      </div>

      {pending.length === 0 ? (
        <EmptyState query={query} />
      ) : (
        <div
          ref={virtual.ref}
          className="shell-scroll min-h-0 flex-1 overflow-auto overscroll-contain"
        >
          <div className="w-full min-w-[62rem]" role="table" aria-label="Pending reviews">
            <div
              className={`sticky top-0 z-[9] grid ${COLS} gap-x-4 border-b border-[var(--border)] bg-surface px-4`}
              role="row"
            >
              <div className={HEADER_CELL}>User</div>
              <div className={HEADER_CELL}>Client</div>
              <div className={HEADER_CELL}>ERP</div>
              <div className={HEADER_CELL}>Team</div>
              <div className={HEADER_CELL}>Duplicate</div>
              <div className={HEADER_CELL}>Uploaded</div>
              <div className={`${HEADER_CELL} justify-end`}>Action</div>
            </div>
            <div role="rowgroup">
              {virtual.padTop > 0 ? (
                <div aria-hidden style={{ height: virtual.padTop }} />
              ) : null}
              {pending.slice(virtual.start, virtual.end).map((item) => (
                <ReviewRow
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  expanded={openId === item.id}
                  onToggle={() =>
                    setExpandedId((current) => (current === item.id ? null : item.id))
                  }
                  onApprove={() => void onApprove(item)}
                  onDecline={() => setDecline(item)}
                />
              ))}
              {virtual.padBottom > 0 ? (
                <div aria-hidden style={{ height: virtual.padBottom }} />
              ) : null}
            </div>
          </div>
        </div>
      )}

      <ViewDocumentDialog />
      <CompareDocumentDialog />
      <DeclineDialog
        item={declineItem}
        busy={busyId === declineItem?.id}
        onClose={() => setDecline(null)}
        onConfirm={() => declineItem && void onReject(declineItem)}
      />
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-canvas text-muted">
        <ScanSearch className="size-5" strokeWidth={1.75} absoluteStrokeWidth />
      </span>
      <p className="mt-4 text-[15px] font-semibold tracking-[-0.02em] text-ink">
        {query.trim() ? "No matches" : "Nothing to review"}
      </p>
      <p className="mt-1 max-w-sm text-[13px] leading-5 text-muted">
        {query.trim()
          ? "No pending uploads match this search."
          : "When a member uploads a duplicate, it waits here until you approve or decline it."}
      </p>
    </div>
  );
}

function allMatches(item: DocumentItem): DuplicateMatch[] {
  const out: DuplicateMatch[] = [];
  const seen = new Set<string>();
  for (const source of item.sources) {
    for (const match of source.duplicates) {
      if (seen.has(match.id)) continue;
      seen.add(match.id);
      out.push(match);
    }
  }
  return out;
}

function dash(value: string | undefined) {
  const next = value?.trim() ?? "";
  return next.length > 0 ? next : "—";
}

function reviewSources(item: DocumentItem): SourceFile[] {
  const dups = item.sources.filter(
    (source) => source.duplicates.length > 0 || source.uniqueness === "duplicate",
  );
  return dups.length > 0 ? dups : item.sources;
}

function matchSummary(matches: DuplicateMatch[]) {
  if (matches.length === 0) return "Duplicate";
  const erps: string[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const erp = match.erp.trim();
    if (!erp || seen.has(erp)) continue;
    seen.add(erp);
    erps.push(erp);
  }
  const count = `${matches.length} ${matches.length === 1 ? "match" : "matches"}`;
  return erps.length > 0 ? `${count} · ${erps.join(", ")}` : count;
}

function stopRow(event: React.SyntheticEvent) {
  event.stopPropagation();
}

function hasTextSelection() {
  const value = window.getSelection()?.toString();
  return Boolean(value && value.length > 0);
}

const ReviewRow = memo(function ReviewRow({
  item,
  busy,
  expanded,
  onToggle,
  onApprove,
  onDecline,
}: {
  item: DocumentItem
  busy: boolean
  expanded: boolean
  onToggle: () => void
  onApprove: () => void
  onDecline: () => void
}) {
  const matches = allMatches(item);
  const sources = reviewSources(item);
  const summary = matchSummary(matches);
  const requested = item.reviewRequestedAt
    ? formatDateTime(item.reviewRequestedAt)
    : "";
  const who = item.member || item.uploader;
  const openClass = statusMeta("pending_review").openClass;
  const hold = useAccordionHold(expanded);
  const openView = () => useDocumentsStore.getState().openView(item.id);
  const openCompare = (sourceId: string) => {
    if (busy) return;
    useDocumentsStore.getState().openCompare(item.id, sourceId);
  };

  const onRowClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, label")) return;
    if (hasTextSelection()) return;
    onToggle();
  };

  const onRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onToggle();
  };

  return (
    <div className="doc-row border-b border-[var(--border)]">
      <div
        role="row"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onRowClick}
        onKeyDown={onRowKeyDown}
        className={`grid ${COLS} cursor-pointer gap-x-4 px-4 outline-none transition-[background-color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] ${
          expanded ? openClass : "hover:bg-surface-muted focus-visible:bg-surface-muted"
        }`}
      >
        <div className={ROW_CELL} role="cell">
          <p className="min-w-0 w-full truncate text-[13px] font-medium tracking-[-0.01em] text-ink">
            {dash(item.member || item.uploader)}
          </p>
        </div>
        <div className={ROW_CELL} role="cell">
          <p className="min-w-0 w-full truncate text-[13px] text-ink">{dash(item.client)}</p>
        </div>
        <div className={ROW_CELL} role="cell">
          <p className="min-w-0 w-full truncate font-mono text-[12px] tabular-nums text-ink">
            {dash(item.erp)}
          </p>
        </div>
        <div className={ROW_CELL} role="cell">
          <p className="min-w-0 w-full truncate text-[13px] text-ink">{dash(item.team)}</p>
        </div>
        <div className={ROW_CELL} role="cell">
          <p className="min-w-0 w-full truncate text-[13px] text-ink" title={summary}>
            {summary}
          </p>
        </div>
        <div className={ROW_CELL} role="cell">
          <p className="min-w-0 w-full truncate text-[12px] tabular-nums text-muted">
            {dash(item.uploaded)}
          </p>
        </div>
        <div
          className={ROW_CELL}
          role="cell"
          onPointerDown={stopRow}
          onClick={stopRow}
        >
          <div className="flex w-full min-w-0 items-center justify-end gap-0.5">
            <IconBtn label="View" disabled={busy} onClick={openView}>
              <Eye className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
            </IconBtn>
            <button
              type="button"
              disabled={busy}
              onClick={onDecline}
              className="inline-flex h-7 w-[4.75rem] shrink-0 items-center justify-center rounded-lg text-[12px] font-medium text-muted outline-none hover:bg-black/[0.06] hover:text-ink disabled:pointer-events-none disabled:opacity-40"
            >
              Decline
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              className="inline-flex h-7 w-[4.75rem] shrink-0 items-center justify-center rounded-lg bg-ink text-[12px] font-medium text-white outline-none hover:bg-black disabled:pointer-events-none disabled:bg-ink/30"
            >
              Approve
            </button>
          </div>
        </div>
      </div>

      <div
        className="doc-accordion"
        data-open={expanded ? "true" : "false"}
        aria-hidden={!expanded}
      >
        <div className="doc-accordion-inner" inert={!hold || undefined}>
          <div className={`${statusMeta("pending_review").surface}`}>
            <div className={`grid ${TITLE_COLS} gap-x-4 px-4`} role="row">
              <div className={HEADER_CELL}>This file</div>
              <div className={HEADER_CELL}>Duplicate of</div>
              <div className={HEADER_CELL}>Match</div>
              <div className={`${HEADER_CELL} justify-end`}>Action</div>
            </div>
            {sources.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-muted">No files on this request.</p>
            ) : (
              sources.map((source) => {
                const rows =
                  source.duplicates.length > 0 ? source.duplicates : [null];
                const own = noteLines(source.note);
                return (
                  <div
                    key={source.id}
                    className="border-t border-[var(--border)] first:border-t-0"
                  >
                    {rows.map((match, index) => {
                      const matchOwn = distinctNote(match?.note, source.note);
                      return (
                        <div
                          key={`${source.id}:${match?.id ?? "none"}`}
                          className={`grid ${TITLE_COLS} gap-x-4 px-4`}
                          role="row"
                        >
                          <div className={TITLE_CELL}>
                            {index === 0 ? (
                              <div className="flex min-w-0 w-full items-center gap-1">
                                <p
                                  title={source.title || "Untitled document"}
                                  className="min-w-0 flex-1 truncate text-[13px] text-ink"
                                >
                                  {source.title || "Untitled document"}
                                </p>
                                {source.note?.trim() ? (
                                  <DuplicateNote
                                    note={source.note}
                                    who={who}
                                    compact
                                    heading="This file"
                                  />
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          <div className={TITLE_CELL}>
                            <div className="flex min-w-0 w-full items-center gap-1">
                              <p
                                title={match?.title || "—"}
                                className="min-w-0 flex-1 truncate text-[13px] text-ink"
                              >
                                {match?.title || "—"}
                              </p>
                              {matchOwn ? (
                                <DuplicateNote
                                  note={matchOwn}
                                  who={match?.member}
                                  compact
                                  heading="Existing file"
                                />
                              ) : null}
                            </div>
                          </div>
                          <div className={TITLE_CELL}>
                            <p className="min-w-0 w-full truncate text-[12px] text-muted">
                              {match
                                ? [match.erp, match.member || match.client, match.score.toFixed(1)]
                                    .filter((part) => part && String(part).trim())
                                    .join(" · ") || "—"
                                : "—"}
                            </p>
                          </div>
                          <div className={`${TITLE_CELL} justify-end`}>
                            {index === 0 && source.duplicates.length > 0 ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => openCompare(source.id)}
                                className="inline-flex h-7 w-[5.75rem] shrink-0 items-center justify-center gap-1 rounded-lg text-[12px] font-medium text-muted outline-none hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-40"
                              >
                                <GitCompare className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
                                Compare
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    <div className="px-4 pb-2.5 pt-0.5">
                      <p className="text-[11px] font-medium tracking-[0.05em] text-muted uppercase">
                        Reason · {source.title || "Untitled document"}
                      </p>
                      {own.length > 0 ? (
                        <ol className="mt-1.5 space-y-1.5">
                          {own.map((line, index) => (
                            <li
                              key={`${source.id}:${index}:${line}`}
                              className="flex gap-2 text-[13px] leading-5 text-ink"
                            >
                              <span className="w-4 shrink-0 tabular-nums text-muted-soft">
                                {index + 1}.
                              </span>
                              <span className="min-w-0 wrap-anywhere">{line}</span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="mt-1 text-[13px] leading-5 text-muted-soft">
                          No reason given for this file.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {requested ? (
              <p className="border-t border-[var(--border)] px-4 py-2 text-[11px] tabular-nums text-muted-soft">
                Requested {requested}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});

function DeclineDialog({
  item,
  busy,
  onClose,
  onConfirm,
}: {
  item: DocumentItem | null
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    if (!item) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        className="absolute inset-0 bg-black/20"
        style={{ animation: "backdropIn 160ms var(--shell-ease) both" }}
        onClick={onClose}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="decline-title"
        className="relative z-[1] w-full max-w-[22.5rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-[var(--shadow-elevated)]"
        style={{ animation: "popoverIn 180ms var(--shell-ease) both" }}
      >
        <div className="px-5 pt-5 pb-4">
          <h2 id="decline-title" className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
            Decline this upload?
          </h2>
          <p className="mt-2 text-[13px] leading-5 text-muted">
            <span className="font-mono tabular-nums text-ink">{item.erp}</span>
            {item.member ? ` from ${item.member}` : ""} will be removed. The member is notified.
          </p>
        </div>
        <div className="h-px bg-[var(--border)]" />
        <div className="flex h-14 items-center justify-end gap-2 px-5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-xl px-3 text-[13px] font-medium text-muted outline-none hover:bg-black/[0.06] hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex h-8 items-center rounded-xl bg-[#ff3b30] px-4 text-[13px] font-medium text-white outline-none hover:bg-[#e0352c] disabled:opacity-40"
          >
            {busy ? "Declining…" : "Decline"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
