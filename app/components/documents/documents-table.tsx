"use client";

import { DocumentsTableHeader, DocumentRow } from "@/app/components/documents/document-row";
import { useDocumentsStore } from "@/app/store/documents-store";

function DocumentsTableBody() {
  const items = useDocumentsStore((s) => s.visibleItems);
  const query = useDocumentsStore((s) => s.query);

  if (items.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-[13px] text-muted">
        {query.trim()
          ? "No documents match this search."
          : "No documents yet."}
      </p>
    );
  }

  return (
    <div role="rowgroup">
      {items.map((item) => (
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
