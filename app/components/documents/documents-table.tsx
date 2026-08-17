"use client";

import { DocumentsTableHeader, DocumentRow } from "@/app/components/documents/document-row";
import { useDocumentsStore } from "@/app/store/documents-store";
import { useUserStore } from "@/app/store/user-store";

function DocumentsTableBody() {
  const items = useDocumentsStore((s) => s.visibleItems);
  const query = useDocumentsStore((s) => s.query);
  const dateFrom = useDocumentsStore((s) => s.dateFrom);
  const dateTo = useDocumentsStore((s) => s.dateTo);
  const role = useUserStore((s) => s.role);
  const rows =
    role === "admin"
      ? items.filter((item) => item.status !== "pending_review")
      : items;

  if (rows.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-[13px] text-muted">
        {query.trim() || dateFrom || dateTo
          ? "No documents match this filter."
          : "No documents yet."}
      </p>
    );
  }

  return (
    <div role="rowgroup">
      {rows.map((item) => (
        <DocumentRow key={item.id} item={item} />
      ))}
    </div>
  );
}

export function DocumentsTable() {
  return (
    <div className="w-full min-w-0" role="table" aria-label="Documents">
      <DocumentsTableHeader />
      <DocumentsTableBody />
    </div>
  );
}
