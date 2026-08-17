"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Columns2, Eye, StickyNote } from "lucide-react";
import { findAnzsco, formatAnzsco } from "@/app/lib/anzsco";
import { findTeam } from "@/app/lib/teams";

const PANEL_WIDTH = 268;
const GAP = 6;
const EDGE = 8;

type Placement = { top: number; left: number };

export type MatchInfo = {
  title?: string
  client?: string
  team?: string
  anzsco?: string
  erp?: string
  member?: string
};

function place(anchor: DOMRect, height = 140): Placement {
  const left = Math.min(
    Math.max(anchor.left, EDGE),
    Math.max(EDGE, window.innerWidth - PANEL_WIDTH - EDGE),
  );
  const below = anchor.bottom + GAP;
  const fitsBelow = below + height <= window.innerHeight;
  const top = fitsBelow ? below : Math.max(EDGE, anchor.top - GAP - height);
  return { top, left };
}

function useAnchorPanel(height = 140) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<Placement | null>(null);
  const open = spot !== null;

  const close = useCallback(() => setSpot(null), []);

  const relocate = useCallback(() => {
    const node = anchorRef.current;
    if (!node) return;
    setSpot(place(node.getBoundingClientRect(), height));
  }, [height]);

  const toggle = useCallback(() => {
    if (spot) {
      close();
      return;
    }
    const anchor = anchorRef.current;
    setSpot(
      anchor ? place(anchor.getBoundingClientRect(), height) : { top: EDGE, left: EDGE },
    );
  }, [spot, close, height]);

  useEffect(() => {
    if (!open) return;

    // Opening a panel inside a dialog can scroll the button into view. If we
    // listen on the same click, that scroll (and the leftover pointerup)
    // would close the panel before anyone sees it.
    let swallowClick = false;
    let attached = false;
    let cancelled = false;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      swallowClick = true;
      close();
    };
    const onClickCapture = (event: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const onScroll = (event: Event) => {
      const panel = panelRef.current;
      const anchor = anchorRef.current;
      const target = event.target as Node | null;
      if (panel && target && (target === panel || panel.contains(target))) return;
      if (anchor && target instanceof Node && target.contains(anchor)) {
        relocate();
        return;
      }
      close();
    };

    const attach = () => {
      if (cancelled || attached) return;
      attached = true;
      document.addEventListener("keydown", onKey, true);
      document.addEventListener("pointerdown", onPointer, true);
      document.addEventListener("click", onClickCapture, true);
      window.addEventListener("resize", relocate);
      window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    };

    let inner = 0;
    const frame = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(attach);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(inner);
      if (!attached) return;
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("resize", relocate);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, close, relocate]);

  return { anchorRef, panelRef, spot, open, close, toggle };
}

export const STORED_DUPLICATE_EMPTY =
  "No saved reason for this existing match.";

export function matchFactsLabel(match: MatchInfo) {
  const anzsco = findAnzsco(match.anzsco);
  const team = findTeam(match.team) ?? match.team?.trim();
  return [
    match.client,
    team,
    anzsco?.title || match.anzsco,
    match.erp,
    match.member,
  ]
    .filter((part) => part && String(part).trim())
    .join(" · ");
}

function display(value: string | undefined) {
  const next = value?.trim() ?? "";
  return next.length > 0 ? next : "—";
}

/**
 * Note marker for a duplicate file. Originals and unique files never carry a
 * note, so callers pass `undefined` there and nothing renders.
 */
export function DuplicateNote({
  note,
  who,
  compact = false,
  emptyText = "This file matched an existing source. No reason was recorded with the review request.",
}: {
  note: string | undefined
  who?: string
  compact?: boolean
  emptyText?: string
}) {
  const text = note?.trim() ?? "";
  const panelId = useId();
  const { anchorRef, panelRef, spot, open, toggle } = useAnchorPanel();
  const size = compact ? "size-5" : "size-6";

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label="Why this duplicate was kept"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title="Why this duplicate was kept"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
        className={`inline-flex ${size} shrink-0 items-center justify-center rounded-lg outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
          open
            ? "bg-orange-100 text-orange-800"
            : "text-orange-700/70 hover:bg-orange-100 hover:text-orange-800"
        }`}
      >
        <StickyNote className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
      </button>
      {open && spot && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label="Duplicate note"
              className="fixed z-[90] overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-[var(--shadow-elevated)]"
              style={{
                top: spot.top,
                left: spot.left,
                width: PANEL_WIDTH,
                animation: "popoverIn 160ms var(--shell-ease) both",
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="px-4 pt-3">
                <p className="text-[11px] font-medium tracking-[0.04em] text-muted-soft uppercase">
                  Kept as duplicate
                </p>
              </div>
              <div className="shell-scroll max-h-56 overflow-y-auto px-4 pb-3 pt-1.5">
                {text ? (
                  <p className="text-[13px] leading-5 wrap-anywhere text-ink">{text}</p>
                ) : (
                  <p className="text-[13px] leading-5 text-muted">{emptyText}</p>
                )}
                {who?.trim() ? (
                  <p className="mt-2 truncate text-[11px] text-muted-soft">
                    Reason given by {who.trim()}
                  </p>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function PeekFact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium tracking-[0.04em] text-muted-soft uppercase">
        {label}
      </p>
      <p className="mt-0.5 truncate text-[13px] leading-4 text-ink">{value}</p>
      {detail ? (
        <p className="mt-0.5 truncate font-mono text-[11px] tabular-nums text-muted">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

/** Eye control that reveals the stored match’s client, team, and ANZSCO. */
export function MatchPeek({
  match,
  compact = true,
}: {
  match: MatchInfo
  compact?: boolean
}) {
  const panelId = useId();
  const { anchorRef, panelRef, spot, open, toggle } = useAnchorPanel(220);
  const size = compact ? "size-5" : "size-6";
  const anzsco = findAnzsco(match.anzsco);
  const team = findTeam(match.team) ?? match.team?.trim();

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label="View matched source details"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title="Matched source details"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
        className={`inline-flex ${size} shrink-0 items-center justify-center rounded-lg outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
          open
            ? "bg-orange-100 text-orange-800"
            : "text-orange-700/70 hover:bg-orange-100 hover:text-orange-800"
        }`}
      >
        <Eye className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
      </button>
      {open && spot && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label="Matched source details"
              className="fixed z-[90] overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-[var(--shadow-elevated)]"
              style={{
                top: spot.top,
                left: spot.left,
                width: PANEL_WIDTH,
                animation: "popoverIn 160ms var(--shell-ease) both",
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="px-4 pt-3">
                <p className="text-[11px] font-medium tracking-[0.04em] text-muted-soft uppercase">
                  Matched source
                </p>
                <p className="mt-1 truncate text-[13px] font-medium tracking-[-0.015em] text-ink">
                  {display(match.title)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-3 px-4 pb-3.5 pt-3">
                <PeekFact label="Client" value={display(match.client)} />
                <PeekFact label="Team" value={display(team)} />
                <div className="col-span-2">
                  <PeekFact
                    label="ANZSCO"
                    value={anzsco?.title || display(formatAnzsco(match.anzsco))}
                    detail={anzsco?.code}
                  />
                </div>
                <PeekFact label="ERP" value={display(match.erp)} />
                <PeekFact label="Member" value={display(match.member)} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Match row: orange “Matches” label, then eye / note / compare on the right. */
export function MatchLine({
  match,
  intra = false,
  note,
  who,
  onCompare,
}: {
  match?: MatchInfo
  intra?: boolean
  note?: string
  who?: string
  onCompare?: () => void
}) {
  const title = match?.title?.trim() ?? "";
  const label = intra
    ? "Already in this upload"
    : title
      ? `Matches ${title}`
      : "Matches an existing source";

  return (
    <div className="mt-1 flex min-w-0 items-center gap-1">
      <p title={label} className="min-w-0 flex-1 truncate text-[11px] leading-4">
        {intra ? (
          <span className="text-muted">{label}</span>
        ) : (
          <>
            <span className="font-semibold text-orange-800">Matches</span>
            {title ? (
              <span className="text-orange-800/80"> {title}</span>
            ) : (
              <span className="text-orange-800/80"> an existing source</span>
            )}
          </>
        )}
      </p>
      {!intra && onCompare ? (
        <span className="flex shrink-0 items-center gap-0.5">
          {match ? <MatchPeek match={match} /> : null}
          <DuplicateNote
            note={note}
            who={who}
            compact
            emptyText={STORED_DUPLICATE_EMPTY}
          />
          <button
            type="button"
            aria-label="Compare with existing source"
            title="Compare"
            onClick={onCompare}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-lg text-orange-700/70 outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-orange-100 hover:text-orange-800 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <Columns2 className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
          </button>
        </span>
      ) : null}
    </div>
  );
}
