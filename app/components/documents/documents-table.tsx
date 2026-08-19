"use client";

import { useCallback, useMemo } from "react";
import { DocumentsTableHeader, DocumentRow } from "@/app/components/documents/document-row";
import { SOURCE_TOTAL } from "@/app/lib/files";
import { useVirtualWindow } from "@/app/hooks/use-virtual-window";
import { useDocumentsStore, peopleFilterActive, type DocumentItem } from "@/app/store/documents-store";
import { useUserStore } from "@/app/store/user-store";

type TableRow =
  | { kind: "section"; key: string; title: string; detail?: string }
  | { kind: "doc"; key: string; item: DocumentItem };

const DOC_ROW = 57;
const SECTION = 40;
const SECTION_DETAIL = 64;
const SOURCE_BLOCK = 44;

function DocumentsTableBody({
  rows,
  start,
  end,
  padTop,
  padBottom,
}: {
  rows: TableRow[]
  start: number
  end: number
  padTop: number
  padBottom: number
}) {
  const query = useDocumentsStore((s) => s.query);
  const dateFrom = useDocumentsStore((s) => s.dateFrom);
  const dateTo = useDocumentsStore((s) => s.dateTo);
  const userKind = useDocumentsStore((s) => s.userKind);
  const teamFilter = useDocumentsStore((s) => s.teamFilter);
  const filtered =
    Boolean(query.trim()) ||
    Boolean(dateFrom || dateTo) ||
    peopleFilterActive(userKind, teamFilter);

  if (rows.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-[13px] text-muted">
        {filtered
          ? "No documents match this filter."
          : "No documents yet."}
      </p>
    );
  }

  const slice = rows.slice(start, end);
  return (
    <div role="rowgroup">
      {padTop > 0 ? <div aria-hidden style={{ height: padTop }} /> : null}
      {slice.map((row) =>
        row.kind === "section" ? (
          <Section key={row.key} title={row.title} detail={row.detail} />
        ) : (
          <DocumentRow key={row.key} item={row.item} />
        ),
      )}
      {padBottom > 0 ? <div aria-hidden style={{ height: padBottom }} /> : null}
    </div>
  );
}

function Section({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="border-b border-[var(--border)] bg-canvas px-4 py-2.5">
      <p className="text-[11px] font-medium tracking-[0.05em] text-muted uppercase">
        {title}
      </p>
      {detail ? (
        <p className="mt-0.5 text-[12px] leading-5 text-muted">{detail}</p>
      ) : null}
    </div>
  );
}

export function DocumentsTable() {
  const items = useDocumentsStore((s) => s.visibleItems);
  const expandedId = useDocumentsStore((s) => s.expandedId);
  const role = useUserStore((s) => s.role);
  const rows = useMemo(() => {
    const visible =
      role === "admin"
        ? items.filter((item) => item.status !== "pending_review")
        : items;
    const untitled = visible.filter((item) => item.titlePending);
    const titled = visible.filter((item) => !item.titlePending);
    const out: TableRow[] = [];
    if (untitled.length > 0) {
      out.push({
        kind: "section",
        key: "untitled",
        title: "Titles in progress",
        detail:
          untitled.length === 1
            ? "1 document is waiting for a printed title. Extraction retries in the background."
            : `${untitled.length} documents are waiting for a printed title. Extraction retries in the background.`,
      });
      for (const item of untitled) {
        out.push({ kind: "doc", key: item.id, item });
      }
    }
    if (untitled.length > 0 && titled.length > 0) {
      out.push({ kind: "section", key: "docs", title: "Documents" });
    }
    for (const item of titled) {
      out.push({ kind: "doc", key: item.id, item });
    }
    return out;
  }, [items, role]);

  const estimate = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) return DOC_ROW;
      if (row.kind === "section") return row.detail ? SECTION_DETAIL : SECTION;
      if (row.item.id !== expandedId) return DOC_ROW;
      const addRow = row.item.sources.length < SOURCE_TOTAL ? SOURCE_BLOCK : 0;
      return DOC_ROW + 84 + row.item.sources.length * SOURCE_BLOCK + addRow;
    },
    [rows, expandedId],
  );

  const virtual = useVirtualWindow(rows.length, estimate, 14, expandedId ?? "");

  return (
    <div
      ref={virtual.ref}
      className="shell-scroll min-h-0 flex-1 overflow-auto overscroll-contain"
    >
      <div className="w-full min-w-[58rem]" role="table" aria-label="Documents">
        <DocumentsTableHeader />
        <DocumentsTableBody
          rows={rows}
          start={virtual.start}
          end={virtual.end}
          padTop={virtual.padTop}
          padBottom={virtual.padBottom}
        />
      </div>
    </div>
  );
}
