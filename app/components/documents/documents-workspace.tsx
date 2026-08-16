"use client";

import { CompareDocumentDialog } from "@/app/components/documents/compare-document-dialog";
import { DeleteDocumentDialog } from "@/app/components/documents/delete-document-dialog";
import { DocumentsTable } from "@/app/components/documents/documents-table";
import { DocumentsToolbar } from "@/app/components/documents/documents-toolbar";
import { DuplicateAddDialog } from "@/app/components/documents/duplicate-add-dialog";
import { ViewDocumentDialog } from "@/app/components/documents/view-document-dialog";
import { useDocumentsStore } from "@/app/store/documents-store";
import { isAdmin, useUserStore } from "@/app/store/user-store";

export function DocumentsWorkspace() {
  const role = useUserStore((s) => s.role);
  const pending = useDocumentsStore(
    (s) => s.items.filter((item) => item.status === "pending_review").length,
  );
  const showBanner = !isAdmin(role) && pending > 0;

  return (
    <div className="flex min-h-full min-w-0 flex-col">
      <DocumentsToolbar />
      {showBanner ? (
        <div className="border-b border-[var(--border)] bg-[#faf6f1] px-4 py-2.5">
          <p className="text-[13px] text-[#8a5a2b]">
            {pending === 1
              ? "1 document is waiting for admin review. You’ll be notified when it’s decided."
              : `${pending} documents are waiting for admin review. You’ll be notified when they’re decided.`}
          </p>
        </div>
      ) : null}
      <DocumentsTable />
      <ViewDocumentDialog />
      <CompareDocumentDialog />
      <DuplicateAddDialog />
      <DeleteDocumentDialog />
    </div>
  );
}
