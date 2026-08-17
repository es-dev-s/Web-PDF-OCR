"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";
import { uploadStats, type UploadStats } from "@/app/lib/api";
import { MONTHS } from "@/app/lib/dates";
import { isAdmin, useUserStore } from "@/app/store/user-store";

function formatDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return `${date} ${MONTHS[month - 1]} ${year}`;
}

export function UploadStatsButton() {
  const role = useUserStore((s) => s.role);
  const admin = isAdmin(role);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ top: 0, right: 0, width: 320 });
  const [stats, setStats] = useState<UploadStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const node = buttonRef.current;
    if (node) {
      const rect = node.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 16);
      const right = Math.max(8, window.innerWidth - rect.right);
      setBox({ top: rect.bottom + 8, right, width });
    }
    const ac = new AbortController();
    setFailed(false);
    void uploadStats()
      .then((data) => {
        if (!ac.signal.aborted) setStats(data);
      })
      .catch(() => {
        if (!ac.signal.aborted) setFailed(true);
      });
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
      ac.abort();
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  if (!admin) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Upload counts"
        title="Upload counts"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted outline-none transition-[color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <CalendarDays className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Upload counts"
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
                  Uploads
                </p>
                <p className="text-[11px] tabular-nums text-muted-soft">
                  Last 30 days · UTC
                </p>
              </div>
              <div className="h-px bg-[var(--border)]" />
              {failed ? (
                <p className="px-3.5 py-8 text-center text-[13px] text-muted">
                  Couldn’t load counts
                </p>
              ) : !stats ? (
                <p className="px-3.5 py-8 text-center text-[13px] text-muted-soft">
                  Loading
                </p>
              ) : (
                <>
                  <div className="flex items-baseline justify-between px-3.5 py-2.5">
                    <p className="text-[13px] text-ink">
                      <span className="tabular-nums">{stats.total.documents}</span>
                      <span className="text-muted">
                        {stats.total.documents === 1 ? " document" : " documents"}
                      </span>
                    </p>
                    <p className="text-[13px] text-ink">
                      <span className="tabular-nums">{stats.total.sources}</span>
                      <span className="text-muted">
                        {stats.total.sources === 1 ? " file" : " files"}
                      </span>
                    </p>
                  </div>
                  {stats.days.length === 0 ? (
                    <p className="px-3.5 pb-4 text-[13px] text-muted">
                      No uploads in this period.
                    </p>
                  ) : (
                    <ul className="shell-scroll max-h-72 overflow-y-auto pb-2">
                      {stats.days.map((row) => (
                        <li
                          key={row.day}
                          className="flex items-baseline justify-between gap-3 px-3.5 py-1.5"
                        >
                          <p className="text-[13px] text-ink">{formatDay(row.day)}</p>
                          <p className="shrink-0 text-[12px] tabular-nums text-muted">
                            {row.documents} · {row.sources}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
