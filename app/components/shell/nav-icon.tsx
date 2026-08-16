"use client";

import Link from "next/link";
import type { NavItem } from "@/app/lib/nav";

type NavIconProps = {
  item: NavItem
  active: boolean
  badge?: number
};

export function NavIcon({ item, active, badge = 0 }: NavIconProps) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      prefetch
      aria-label={badge > 0 ? `${item.label}, ${badge} pending` : item.label}
      aria-current={active ? "page" : undefined}
      className={`group relative flex size-8 shrink-0 items-center justify-center rounded-lg outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
        active
          ? "bg-surface-muted text-ink"
          : "text-muted hover:text-ink"
      }`}
    >
      <Icon className="size-4" strokeWidth={1.75} absoluteStrokeWidth />
      {badge > 0 ? (
        <span className="absolute top-0.5 right-0.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#007aff] px-0.5 text-[9px] font-semibold leading-none text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
      <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 rounded-xl bg-ink px-2 py-1 text-[11px] font-medium leading-none text-white opacity-0 shadow-[var(--shadow-elevated)] transition-opacity duration-[var(--shell-duration)] ease-[var(--shell-ease)] group-hover:opacity-100 group-focus-visible:opacity-100">
        {item.label}
      </span>
    </Link>
  );
}
