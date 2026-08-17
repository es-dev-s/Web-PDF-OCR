"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { uploadStats, type UploadStats } from "@/app/lib/api";
import {
  MONTHS,
  WEEKDAYS,
  formatDayKey,
  monthCells,
  shiftMonth,
  todayKey,
} from "@/app/lib/dates";
import { useDocumentsStore } from "@/app/store/documents-store";
import { isAdmin, useUserStore } from "@/app/store/user-store";

function rangeBounds(from: string | null, to: string | null, hover: string | null) {
  if (!from) return { start: null as string | null, end: null as string | null };
  const end = to ?? hover;
  if (!end) return { start: from, end: from };
  return from <= end ? { start: from, end } : { start: end, end: from };
}

function DayChip({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-medium tracking-[0.04em] text-muted-soft uppercase">
        {label}
      </p>
      <p
        className={`mt-0.5 truncate text-[13px] leading-4 ${
          value ? "text-ink" : "text-muted-soft"
        }`}
      >
        {value ? formatDayKey(value) : "Any"}
      </p>
    </div>
  );
}

export function DateFilterButton() {
  const role = useUserStore((s) => s.role);
  const admin = isAdmin(role);
  const dateFrom = useDocumentsStore((s) => s.dateFrom);
  const dateTo = useDocumentsStore((s) => s.dateTo);
  const setDateRange = useDocumentsStore((s) => s.setDateRange);
  const active = Boolean(dateFrom || dateTo);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ top: 0, right: 0, width: 308 });
  const today = todayKey();
  const [view, setView] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [hover, setHover] = useState<string | null>(null);
  const [stats, setStats] = useState<UploadStats | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);

  const cells = useMemo(
    () => monthCells(view.year, view.month),
    [view.year, view.month],
  );
  const bounds = rangeBounds(dateFrom, dateTo, hover);

  useEffect(() => {
    if (!open) {
      setHover(null);
      return;
    }
    const node = buttonRef.current;
    if (node) {
      const rect = node.getBoundingClientRect();
      const width = Math.min(308, window.innerWidth - 16);
      const right = Math.max(8, window.innerWidth - rect.right);
      setBox({ top: rect.bottom + 8, right, width });
    }
    const seed =
      useDocumentsStore.getState().dateFrom ||
      useDocumentsStore.getState().dateTo ||
      today;
    const [year, month] = seed.split("-").map(Number);
    if (year && month) setView({ year, month: month - 1 });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, today]);

  useEffect(() => {
    if (!open || !admin) return;
    const ac = new AbortController();
    setStatsFailed(false);
    setStats(null);
    const from = dateFrom ?? undefined;
    const to = dateTo ?? dateFrom ?? undefined;
    void uploadStats(from, to)
      .then((data) => {
        if (!ac.signal.aborted) setStats(data);
      })
      .catch(() => {
        if (!ac.signal.aborted) setStatsFailed(true);
      });
    return () => ac.abort();
  }, [open, admin, dateFrom, dateTo]);

  const pick = (key: string) => {
    if (key > today) return;
    if (!dateFrom || (dateFrom && dateTo)) {
      setDateRange(key, null);
      return;
    }
    if (key < dateFrom) {
      setDateRange(key, dateFrom);
      return;
    }
    setDateRange(dateFrom, key);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Filter by date"
        title="Filter by date"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg outline-none transition-[color,background-color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
          open || active
            ? "bg-black/[0.06] text-ink"
            : "text-muted hover:text-ink"
        }`}
      >
        <CalendarDays className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Filter by date"
              className="fixed z-50 overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-[var(--shadow-elevated)]"
              style={{
                top: box.top,
                right: box.right,
                width: box.width,
                animation: "popoverIn 160ms var(--shell-ease) both",
              }}
            >
              <div className="flex h-10 items-center justify-between px-3.5">
                <p className="text-[13px] font-semibold tracking-[-0.02em] text-ink">
                  Date
                </p>
                {active ? (
                  <button
                    type="button"
                    onClick={() => setDateRange(null, null)}
                    className="text-[12px] font-medium text-muted outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:text-ink focus-visible:text-ink"
                  >
                    Clear
                  </button>
                ) : (
                  <p className="text-[11px] text-muted-soft">From and to</p>
                )}
              </div>
              <div className="h-px bg-[var(--border)]" />
              <div className="flex gap-3 px-3.5 py-2.5">
                <DayChip label="From" value={dateFrom} />
                <div className="w-px self-stretch bg-[var(--border)]" />
                <DayChip label="To" value={dateTo ?? (dateFrom ? dateFrom : null)} />
              </div>
              <div className="px-2.5 pb-3">
                <div className="flex h-8 items-center justify-between px-1">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() =>
                      setView((current) => shiftMonth(current.year, current.month, -1))
                    }
                    className="flex size-7 items-center justify-center rounded-lg text-muted outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.04] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <ChevronLeft className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
                  </button>
                  <p className="text-[13px] font-medium tracking-[-0.015em] text-ink">
                    {MONTHS[view.month]} {view.year}
                  </p>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() =>
                      setView((current) => shiftMonth(current.year, current.month, 1))
                    }
                    className="flex size-7 items-center justify-center rounded-lg text-muted outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.04] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <ChevronRight className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
                  </button>
                </div>
                <div className="mt-1 grid grid-cols-7">
                  {WEEKDAYS.map((day) => (
                    <p
                      key={day}
                      className="flex h-7 items-center justify-center text-[10px] font-medium tracking-[0.04em] text-muted-soft uppercase"
                    >
                      {day}
                    </p>
                  ))}
                  {cells.map((cell) => {
                    const future = cell.key > today;
                    const start = bounds.start === cell.key;
                    const end = bounds.end === cell.key;
                    const inRange =
                      bounds.start &&
                      bounds.end &&
                      cell.key > bounds.start &&
                      cell.key < bounds.end;
                    const edge = start || end;
                    return (
                      <button
                        key={cell.key + String(cell.inMonth)}
                        type="button"
                        disabled={future}
                        onMouseEnter={() => {
                          if (!future) setHover(cell.key);
                        }}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => pick(cell.key)}
                        className={`relative flex h-8 items-center justify-center text-[12px] outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-default disabled:opacity-30 ${
                          !cell.inMonth && !edge && !inRange ? "text-muted-soft" : "text-ink"
                        }`}
                      >
                        {inRange ? (
                          <span className="absolute inset-y-1 inset-x-0 bg-[var(--accent-soft)]" />
                        ) : null}
                        {start && bounds.end && bounds.end !== bounds.start ? (
                          <span className="absolute inset-y-1 left-1/2 right-0 bg-[var(--accent-soft)]" />
                        ) : null}
                        {end && bounds.start && bounds.start !== bounds.end ? (
                          <span className="absolute inset-y-1 left-0 right-1/2 bg-[var(--accent-soft)]" />
                        ) : null}
                        <span
                          className={`relative z-[1] flex size-7 items-center justify-center rounded-full tabular-nums ${
                            edge
                              ? "bg-ink text-white"
                              : cell.key === today
                                ? "ring-1 ring-[var(--ring)]"
                                : "hover:bg-black/[0.04]"
                          }`}
                        >
                          {cell.day}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {admin ? (
                <>
                  <div className="h-px bg-[var(--border)]" />
                  <div className="flex items-baseline justify-between px-3.5 py-2.5">
                    <p className="text-[12px] text-muted">Uploads</p>
                    {statsFailed ? (
                      <p className="text-[12px] text-muted-soft">Unavailable</p>
                    ) : !stats ? (
                      <p className="text-[12px] text-muted-soft">Loading</p>
                    ) : (
                      <p className="text-[12px] tabular-nums text-ink">
                        {stats.total.documents}
                        <span className="text-muted">
                          {stats.total.documents === 1 ? " document" : " documents"}
                        </span>
                        <span className="text-muted-soft"> · </span>
                        {stats.total.sources}
                        <span className="text-muted">
                          {stats.total.sources === 1 ? " file" : " files"}
                        </span>
                      </p>
                    )}
                  </div>
                </>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
