"use client";

import Link from "next/link";
import { ScanText } from "lucide-react";

export function BrandMark() {
  return (
    <div className="flex h-full w-[var(--sidebar-w)] shrink-0 items-center justify-center">
      <Link
        href="/documents"
        prefetch
        aria-label="Web OCR"
        className="flex size-[22px] items-center justify-center rounded-[6px] bg-black text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <ScanText
          className="size-3"
          strokeWidth={1.75}
          absoluteStrokeWidth
        />
      </Link>
    </div>
  );
}
