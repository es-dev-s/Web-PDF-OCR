"use client";

import { DeleteDocumentDialog } from "@/app/components/documents/delete-document-dialog";
import { DocumentsTable } from "@/app/components/documents/documents-table";
import { DocumentsToolbar } from "@/app/components/documents/documents-toolbar";
import { DuplicateAddDialog } from "@/app/components/documents/duplicate-add-dialog";
import { ViewDocumentDialog } from "@/app/components/documents/view-document-dialog";

export function DocumentsWorkspace() {
  return (
    <div className="flex min-h-full min-w-0 flex-col">
      <DocumentsToolbar />
      <DocumentsTable />
      <ViewDocumentDialog />
      <DuplicateAddDialog />
      <DeleteDocumentDialog />
    </div>
  );
}
