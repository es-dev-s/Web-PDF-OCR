"use client";

import { displayTitle } from "@/app/lib/titles";

type Props = {
  value: string
  className?: string
};

export function DocTitle({ value, className = "" }: Props) {
  const heading = displayTitle(value);
  return (
    <span
      title={heading}
      className={`block min-w-0 wrap-anywhere break-words leading-snug ${className}`}
    >
      {heading}
    </span>
  );
}
