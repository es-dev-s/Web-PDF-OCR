"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, RotateCw, Search } from "lucide-react";
import { AddDocumentDialog } from "@/app/components/documents/add-document-dialog";
import {
  selectVisibleCount,
  useDocumentsStore,
} from "@/app/store/documents-store";

function DocumentSearch() {
  const query = useDocumentsStore((s) => s.query);
  const setQuery = useDocumentsStore((s) => s.setQuery);

  return (
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
  );
}

function DocumentRowCount() {
  const count = useDocumentsStore(selectVisibleCount);

  return (
    <span className="inline-flex h-8 w-[7.5rem] shrink-0 items-center text-[12px] leading-none tabular-nums text-muted">
      {count} {count === 1 ? "row" : "rows"}
    </span>
  );
}

const RELOAD_SPIN_MS = 650;

function DocumentReload() {
  const refresh = useDocumentsStore((s) => s.refresh);
  const [spinning, setSpinning] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const spinTimer = useRef<number>(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(spinTimer.current);
    };
  }, []);

  const onClick = () => {
    if (busy.current) return;
    busy.current = true;
    setSpinning(true);
    const minSpin = new Promise<void>((resolve) => {
      spinTimer.current = window.setTimeout(resolve, RELOAD_SPIN_MS);
    });
    void Promise.all([refresh(), minSpin]).finally(() => {
      busy.current = false;
      if (mounted.current) setSpinning(false);
    });
  };

  return (
    <button
      type="button"
      aria-label="Reload"
      title="Reload"
      disabled={spinning}
      onClick={onClick}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted outline-none transition-[color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:text-muted"
    >
      <span
        className={`flex size-3.5 items-center justify-center ${spinning ? "reload-spin" : ""}`}
      >
        <RotateCw className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
      </span>
    </button>
  );
}

function DocumentAdd() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 w-[9.75rem] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-ink px-4 text-[13px] font-medium tracking-[-0.015em] text-white outline-none transition-[background-color,width] duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:w-[11.5rem] md:w-[13rem]"
      >
        <Plus className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
        <span>Add document</span>
      </button>
      <AddDocumentDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function DocumentsToolbar() {
  return (
    <div className="sticky top-0 z-10 flex h-[var(--toolbar-h)] shrink-0 items-center gap-3 overflow-hidden border-b border-[var(--border)] bg-surface px-4 [contain:layout]">
      <DocumentSearch />
      <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
        <DocumentRowCount />
        <DocumentReload />
        <DocumentAdd />
      </div>
    </div>
  );
}
