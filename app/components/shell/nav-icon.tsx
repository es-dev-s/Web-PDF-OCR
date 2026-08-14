"use client";

import Link from "next/link";
import type { NavItem } from "@/app/lib/nav";

type NavIconProps = {
  item: NavItem
  active: boolean
};

export function NavIcon({ item, active }: NavIconProps) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      prefetch
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={`group relative flex size-8 shrink-0 items-center justify-center rounded-lg outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
        active
          ? "bg-surface-muted text-ink"
          : "text-muted hover:text-ink"
      }`}
    >
      <Icon className="size-4" strokeWidth={1.75} absoluteStrokeWidth />
      <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 rounded-xl bg-ink px-2 py-1 text-[11px] font-medium leading-none text-white opacity-0 shadow-[var(--shadow-elevated)] transition-opacity duration-[var(--shell-duration)] ease-[var(--shell-ease)] group-hover:opacity-100 group-focus-visible:opacity-100">
        {item.label}
      </span>
    </Link>
  );
}
