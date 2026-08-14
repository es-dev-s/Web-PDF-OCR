"use client";

type Props = {
  value: string
  className?: string
};

export function DocTitle({ value, className = "" }: Props) {
  return (
    <span
      title={value}
      className={`block min-w-0 wrap-anywhere break-words leading-snug ${className}`}
    >
      {value}
    </span>
  );
}
