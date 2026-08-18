"use client";

import { useEffect, useState } from "react";
import { ScanText } from "lucide-react";
import { DocumentDetail } from "@/app/components/documents/document-detail";
import { ApiError, getPublicDocument } from "@/app/lib/api";
import {
  mapDocument,
  type DocumentItem,
} from "@/app/store/documents-store";

type LoadState = "loading" | "ready" | "missing" | "error";

export function PublicDocumentPage({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>("loading");
  const [item, setItem] = useState<DocumentItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPublicDocument(id)
      .then((raw) => {
        if (cancelled) return;
        const next = mapDocument(raw);
        setItem(next);
        setState("ready");
        const heading = next.title || next.client || next.erp || "Document";
        document.title = `${heading} · Web OCR`;
      })
      .catch((error) => {
        if (cancelled) return;
        const missing =
          error instanceof ApiError &&
          (error.status === 404 || error.status === 400);
        setState(missing ? "missing" : "error");
        document.title = missing ? "Document unavailable · Web OCR" : "Web OCR";
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[32rem] flex-col px-5 py-8">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex size-[22px] items-center justify-center rounded-[6px] bg-black text-white">
          <ScanText className="size-3" strokeWidth={1.75} absoluteStrokeWidth />
        </span>
        <p className="text-[13px] font-medium tracking-[-0.01em] text-ink">
          Web OCR
        </p>
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-surface px-5 py-5 shadow-[var(--shadow-soft)]">
        {state === "loading" ? (
          <p className="py-10 text-center text-[13px] text-muted">Loading…</p>
        ) : state === "missing" ? (
          <div className="py-10 text-center">
            <p className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
              Document unavailable
            </p>
            <p className="mt-2 text-[13px] text-muted">
              This link is invalid or the document is still in review.
            </p>
          </div>
        ) : state === "error" ? (
          <p className="py-10 text-center text-[13px] text-muted">
            Could not load this document. Try again shortly.
          </p>
        ) : item ? (
          <DocumentDetail item={item} />
        ) : null}
      </div>
    </div>
  );
}
