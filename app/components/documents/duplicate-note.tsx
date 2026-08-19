"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Columns2, Eye, NotebookPen, StickyNote } from "lucide-react";
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
      event.stopImmediatePropagation();
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

    const attachPointer = () => {
      if (cancelled || attached) return;
      attached = true;
      document.addEventListener("pointerdown", onPointer, true);
      document.addEventListener("click", onClickCapture, true);
      window.addEventListener("resize", relocate);
      window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    };

    document.addEventListener("keydown", onKey, true);
    let inner = 0;
    const frame = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(attachPointer);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(inner);
      document.removeEventListener("keydown", onKey, true);
      if (!attached) return;
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

export function noteLines(note?: string): string[] {
  if (!note) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of note.split(/\r?\n/)) {
    const next = line.trim();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

export function mergeNotes(...chunks: Array<string | undefined>): string {
  return noteLines(chunks.filter(Boolean).join("\n")).join("\n");
}

/** Full history for a saved file; own reason when no log is present. */
export function historyNote(own?: string, log?: string): string | undefined {
  const next = (log || own || "").trim();
  return next.length > 0 ? next : undefined;
}

function notesEqual(left?: string, right?: string) {
  return noteLines(left).join("\n") === noteLines(right).join("\n");
}

/** Match-row note that is not just a copy of this file's own reason. */
export function distinctNote(note?: string, other?: string): string | undefined {
  const next = (note || "").trim();
  if (!next || notesEqual(next, other)) return undefined;
  return next;
}

/** Combined reasons already on a matched file, one entry per line. */
export function PastNoteList({
  note,
  who,
  heading = "Past notes",
}: {
  note?: string
  who?: string
  heading?: string
}) {
  const lines = noteLines(note);
  if (lines.length === 0) return null;
  return (
    <div className="mt-1.5 min-w-0 rounded-xl bg-orange-50/90 px-2.5 py-2">
      <p className="text-[10px] font-medium tracking-[0.04em] text-orange-800/70 uppercase">
        {heading}
      </p>
      <ol className="mt-1.5 space-y-1.5">
        {lines.map((line, index) => (
          <li
            key={`${index}:${line}`}
            className="flex gap-2 border-t border-orange-200/70 pt-1.5 first:border-t-0 first:pt-0"
          >
            <span className="w-3.5 shrink-0 text-[11px] tabular-nums text-orange-800/55">
              {index + 1}.
            </span>
            <span className="min-w-0 text-[12px] leading-4 wrap-anywhere text-ink">
              {line}
            </span>
          </li>
        ))}
      </ol>
      {who?.trim() && lines.length === 1 ? (
        <p className="mt-1.5 truncate text-[10px] text-orange-800/55">
          Last added by {who.trim()}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Note marker for a duplicate file. Originals and unique files never carry a
 * note, so callers pass `undefined` there and nothing renders.
 */
export function DuplicateNote({
  note,
  who,
  compact = false,
  heading = "Kept as duplicate",
  emptyText = "This file matched an existing source. No reason was recorded with the review request.",
}: {
  note: string | undefined
  who?: string
  compact?: boolean
  heading?: string
  emptyText?: string
}) {
  const lines = noteLines(note);
  const panelId = useId();
  const { anchorRef, panelRef, spot, open, toggle } = useAnchorPanel(lines.length > 1 ? 220 : 140);
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
                  {heading}
                </p>
              </div>
              <div className="shell-scroll max-h-56 overflow-y-auto px-4 pb-3 pt-1.5">
                {lines.length > 0 ? (
                  <ol className="space-y-2">
                    {lines.map((line, index) => (
                      <li
                        key={`${index}:${line}`}
                        className="flex gap-2 text-[13px] leading-5 wrap-anywhere text-ink"
                      >
                        <span className="w-4 shrink-0 tabular-nums text-muted-soft">
                          {index + 1}.
                        </span>
                        <span className="min-w-0">{line}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[13px] leading-5 text-muted">{emptyText}</p>
                )}
                {who?.trim() && lines.length === 1 ? (
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

/** Visible reason field on a duplicate in the upload list. One file, one note. */
export function IncomingDuplicateField({
  value,
  onChange,
  missing = false,
}: {
  value: string
  onChange: (next: string) => void
  missing?: boolean
}) {
  return (
    <label className="mt-1.5 block min-w-0">
      <span className="mb-1 block text-[10px] font-medium tracking-[0.04em] text-muted-soft uppercase">
        Note for this duplicate
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, 500))}
        rows={2}
        maxLength={500}
        required
        aria-invalid={missing || undefined}
        placeholder="Why should this file be kept?"
        className={`min-h-[3.25rem] w-full resize-none rounded-xl border bg-canvas px-3 py-2 text-[13px] leading-5 text-ink outline-none placeholder:text-muted-soft ${
          missing
            ? "border-orange-300 focus:border-orange-400"
            : "border-[var(--border)] focus:border-[var(--border-strong)]"
        }`}
      />
    </label>
  );
}

export function IncomingDuplicateNote({
  value,
  onChange,
  required = false,
  past,
}: {
  value: string
  onChange: (next: string) => void
  required?: boolean
  past?: string
}) {
  const saved = value.trim();
  const pastLines = noteLines(past);
  const panelId = useId();
  const { anchorRef, panelRef, spot, open, close, toggle } = useAnchorPanel(
    pastLines.length > 0 ? Math.min(420, 280 + pastLines.length * 28) : 280,
  );
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) setDraft(value);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const save = () => {
    const next = draft.trim();
    if (required && next.length === 0) return;
    onChange(next);
    close();
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={
          saved
            ? "Edit reason for this upload"
            : "Add a reason for this upload"
        }
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={saved ? "Reason for this upload" : "Add a reason for this upload"}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
        className={`relative inline-flex size-5 shrink-0 items-center justify-center rounded-lg outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
          open || saved
            ? "bg-[#eef4ff] text-[#3b5bcc]"
            : required
              ? "text-orange-700/80 hover:bg-orange-100 hover:text-orange-800"
              : "text-muted hover:bg-black/[0.06] hover:text-ink"
        }`}
      >
        <NotebookPen className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
        {required && !saved ? (
          <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-orange-500" />
        ) : null}
      </button>
      {open && spot && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label="Reason for this upload"
              className="fixed z-[90] overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-[var(--shadow-elevated)]"
              style={{
                top: spot.top,
                left: spot.left,
                width: PANEL_WIDTH,
                animation: "popoverIn 160ms var(--shell-ease) both",
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <div className="px-4 pt-3">
                <p className="text-[11px] font-medium tracking-[0.04em] text-muted-soft uppercase">
                  Reason for this upload
                </p>
              </div>
              {pastLines.length > 0 ? (
                <div className="shell-scroll max-h-36 overflow-y-auto px-4 pt-1.5">
                  <p className="text-[10px] font-medium tracking-[0.04em] text-orange-800/70 uppercase">
                    Already on this file
                  </p>
                  <ol className="mt-1.5 space-y-1.5">
                    {pastLines.map((line, index) => (
                      <li
                        key={`${index}:${line}`}
                        className="flex gap-2 border-t border-[var(--border)] pt-1.5 first:border-t-0 first:pt-0"
                      >
                        <span className="w-3.5 shrink-0 text-[11px] tabular-nums text-muted-soft">
                          {index + 1}.
                        </span>
                        <span className="min-w-0 text-[12px] leading-4 wrap-anywhere text-ink">
                          {line}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <div className="px-4 pt-1.5">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value.slice(0, 500))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      save();
                    }
                  }}
                  rows={4}
                  maxLength={500}
                  placeholder="Why should this file be kept?"
                  className="min-h-[5.5rem] w-full resize-none rounded-xl border border-[var(--border)] bg-canvas px-3 py-2 text-[13px] leading-5 text-ink outline-none placeholder:text-muted-soft focus:border-[var(--border-strong)]"
                />
              </div>
              <div className="flex items-center justify-between gap-2 px-4 pt-2 pb-3">
                <p className="min-w-0 text-[11px] leading-4 text-muted-soft">
                  {required ? "Required for this file." : "Saved on this file only."}
                </p>
                <button
                  type="button"
                  onClick={save}
                  disabled={required && draft.trim().length === 0}
                  className="inline-flex h-7 shrink-0 items-center rounded-lg bg-ink px-3 text-[12px] font-medium text-white outline-none hover:bg-black focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:bg-ink/30"
                >
                  Save
                </button>
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

/** Match row: the file already on the platform — view-only note, never the upload reason. */
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
    <div className="mt-1 min-w-0">
      <div className="flex min-w-0 items-center gap-1">
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
        {!intra ? (
          <span className="flex shrink-0 items-center gap-0.5">
            {match ? <MatchPeek match={match} /> : null}
            {onCompare ? (
              <button
                type="button"
                aria-label="Compare with existing source"
                title="Compare"
                onClick={onCompare}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-lg text-orange-700/70 outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-orange-100 hover:text-orange-800 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <Columns2 className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
      {!intra ? <PastNoteList note={note} who={who} /> : null}
    </div>
  );
}
