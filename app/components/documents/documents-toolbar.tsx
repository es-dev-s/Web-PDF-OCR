"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, RotateCw, Search } from "lucide-react";
import { AddDocumentDialog } from "@/app/components/documents/add-document-dialog";
import { DateFilterButton } from "@/app/components/documents/date-filter";
import { PeopleFilterButton } from "@/app/components/documents/people-filter";
import {
  listedDocuments,
  listedFileCount,
  peopleFilterActive,
  useDocumentsStore,
} from "@/app/store/documents-store";
import { useUserStore } from "@/app/store/user-store";

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
        placeholder="Search client, team, or ANZSCO"
        aria-label="Search by client, team, or ANZSCO"
        autoComplete="off"
        spellCheck={false}
        className="h-8 w-full rounded-xl border border-[var(--border)] bg-canvas pr-3 pl-8 text-[13px] text-ink outline-none placeholder:text-muted-soft focus:border-[var(--border-strong)]"
      />
    </label>
  );
}

function DocumentStats() {
  const items = useDocumentsStore((s) => s.items);
  const visible = useDocumentsStore((s) => s.visibleItems);
  const query = useDocumentsStore((s) => s.query);
  const dateFrom = useDocumentsStore((s) => s.dateFrom);
  const dateTo = useDocumentsStore((s) => s.dateTo);
  const userKind = useDocumentsStore((s) => s.userKind);
  const teamFilter = useDocumentsStore((s) => s.teamFilter);
  const role = useUserStore((s) => s.role);
  const rows = listedDocuments(visible, role);
  const files = listedFileCount(visible, role);
  const allFiles = listedFileCount(items, role);
  const narrowed =
    Boolean(query.trim()) ||
    Boolean(dateFrom || dateTo) ||
    peopleFilterActive(userKind, teamFilter);

  const fileLabel = files === 1 ? "document" : "documents";
  const rowLabel = rows.length === 1 ? "row" : "rows";
  const fileText =
    narrowed && files !== allFiles ? `${files} of ${allFiles}` : String(files);

  return (
    <p
      className={`flex h-8 shrink-0 items-center rounded-xl px-2.5 text-[12px] leading-none tabular-nums transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] ${
        narrowed
          ? "bg-black/[0.06] text-ink"
          : "text-muted"
      }`}
      title={narrowed ? "Counts for the current filter" : undefined}
    >
      <span>
        <span className={narrowed ? "font-medium" : undefined}>{fileText}</span>
        <span className={narrowed ? "text-muted" : "text-muted-soft"}>
          {" "}
          {fileLabel}
        </span>
      </span>
      <span className={`mx-2 ${narrowed ? "text-muted" : "text-muted-soft"}`}>
        ·
      </span>
      <span>
        <span className={narrowed ? "font-medium" : undefined}>
          {rows.length}
        </span>
        <span className={narrowed ? "text-muted" : "text-muted-soft"}>
          {" "}
          {rowLabel}
        </span>
      </span>
    </p>
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
  const actionError = useDocumentsStore((s) => s.actionError);
  const clearActionError = useDocumentsStore((s) => s.clearActionError);

  return (
    <div className="sticky top-0 z-10 flex h-[var(--toolbar-h)] shrink-0 items-center gap-2 overflow-hidden border-b border-[var(--border)] bg-surface px-4 [contain:layout]">
      <DocumentSearch />
      <DocumentStats />
      <DateFilterButton />
      <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
        {actionError ? (
          <button
            type="button"
            onClick={clearActionError}
            className="max-w-[16rem] truncate text-left text-[12px] text-red-600 outline-none hover:underline"
            title={actionError}
          >
            {actionError}
          </button>
        ) : null}
        <DocumentReload />
        <PeopleFilterButton />
        <DocumentAdd />
      </div>
    </div>
  );
}
