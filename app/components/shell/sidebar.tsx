"use client";

import { usePathname } from "next/navigation";
import { isNavActive, NAV_FOOTER, NAV_PRIMARY } from "@/app/lib/nav";
import { NavIcon } from "@/app/components/shell/nav-icon";

export function Sidebar() {
  const pathname = usePathname() ?? "/";

  return (
    <aside className="flex h-full w-[var(--sidebar-w)] shrink-0 flex-col items-center bg-surface">
      <nav
        aria-label="Primary"
        className="flex w-full flex-1 flex-col items-center gap-1 pt-2"
      >
        {NAV_PRIMARY.map((item) => (
          <NavIcon
            key={item.href}
            item={item}
            active={isNavActive(pathname, item.href)}
          />
        ))}
      </nav>

      <nav
        aria-label="Settings"
        className="flex w-full flex-col items-center pb-2"
      >
        {NAV_FOOTER.map((item) => (
          <NavIcon
            key={item.href}
            item={item}
            active={isNavActive(pathname, item.href)}
          />
        ))}
      </nav>
    </aside>
  );
}
