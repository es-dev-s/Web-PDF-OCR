"use client";

import { useEffect, useState, type ReactNode } from "react";
import { uniquenessMeta, type SourceUniqueness } from "@/app/lib/files";

function looksLikeImage(src: string, contentType?: string) {
  const type = (contentType ?? "").toLowerCase();
  if (type.startsWith("image/")) return true;
  if (type.includes("pdf")) return false;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(src);
}

function EmptyPreview({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center px-8 text-center">
      <p className="text-[13px] leading-5 text-muted">{text}</p>
    </div>
  );
}

function PdfOrImage({
  src,
  contentType,
  label,
}: {
  src: string
  contentType?: string
  label: string
}) {
  if (looksLikeImage(src, contentType)) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--canvas)] p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  return (
    <iframe src={src} title={label} className="h-full w-full border-0 bg-white" />
  );
}

function RemoteFile({
  url,
  contentType,
  label,
}: {
  url: string
  contentType?: string
  label: string
}) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    const held = { url: "" };
    void fetch(url, { credentials: "include", cache: "no-store", signal: ac.signal })
      .then((response) => {
        if (!response.ok) throw new Error("unavailable");
        const type = (response.headers.get("content-type") || "").toLowerCase();
        if (type.includes("json") || type.includes("html")) {
          throw new Error("unavailable");
        }
        return response.blob();
      })
      .then((blob) => {
        if (ac.signal.aborted) return;
        if (blob.size === 0) throw new Error("empty");
        held.url = URL.createObjectURL(blob);
        setSrc(held.url);
      })
      .catch((error) => {
        if (ac.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      });
    return () => {
      ac.abort();
      if (held.url) URL.revokeObjectURL(held.url);
    };
  }, [url]);

  if (failed) {
    return <EmptyPreview text="This file isn’t in storage." />;
  }
  if (!src) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[13px] text-muted-soft">Loading preview</p>
      </div>
    );
  }
  return <PdfOrImage src={src} contentType={contentType} label={label} />;
}

export function FileStage({
  url,
  contentType,
  label,
}: {
  url?: string
  contentType?: string
  label: string
}) {
  if (!url) {
    return <EmptyPreview text="This file isn’t available to preview." />;
  }
  if (url.startsWith("blob:") || url.startsWith("data:")) {
    return <PdfOrImage src={url} contentType={contentType} label={label} />;
  }
  return <RemoteFile url={url} contentType={contentType} label={label} />;
}

export function PaneHead({
  kicker,
  title,
  detail,
  uniqueness,
  trailing,
}: {
  kicker: string
  title: string
  detail: string
  uniqueness?: SourceUniqueness
  trailing?: ReactNode
}) {
  const pill = uniqueness ? uniquenessMeta(uniqueness) : null;
  return (
    <div className="flex min-h-14 shrink-0 items-center gap-4 border-b border-[var(--border)] px-5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-medium tracking-[0.06em] text-muted-soft uppercase">
            {kicker}
          </p>
          {pill ? (
            <span
              className={`inline-flex h-5 items-center rounded-full px-1.5 text-[10px] font-medium ${pill.className}`}
            >
              {pill.label}
            </span>
          ) : null}
        </div>
        <p title={title} className="mt-0.5 truncate text-[13px] font-medium tracking-[-0.015em] text-ink">
          {title}
        </p>
        <p className="truncate text-[11px] text-muted">{detail}</p>
      </div>
      {trailing}
    </div>
  );
}
