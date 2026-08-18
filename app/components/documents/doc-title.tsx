"use client";

import { displayTitle } from "@/app/lib/titles";

type Props = {
  value: string
  className?: string
  extracting?: boolean
};

export function DocTitle({ value, className = "", extracting = false }: Props) {
  const heading = displayTitle(value);
  return (
    <span
      title={extracting ? `${heading} · extracting printed title` : heading}
      className={`block min-w-0 wrap-anywhere break-words leading-snug ${className}`}
    >
      {heading}
      {extracting ? (
        <span className="mt-0.5 block text-[11px] font-normal tracking-normal text-muted">
          Extracting printed title
        </span>
      ) : null}
    </span>
  );
}
