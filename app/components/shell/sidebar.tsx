"use client";

import { usePathname } from "next/navigation";
import { isNavActive, NAV_FOOTER, navForRole } from "@/app/lib/nav";
import { NavIcon } from "@/app/components/shell/nav-icon";
import { useDocumentsStore } from "@/app/store/documents-store";
import { useUserStore } from "@/app/store/user-store";

export function Sidebar() {
  const pathname = usePathname() ?? "/";
  const role = useUserStore((s) => s.role);
  const items = navForRole(role);
  const pending = useDocumentsStore(
    (s) => s.items.filter((item) => item.status === "pending_review").length,
  );

  return (
    <aside className="flex h-full w-[var(--sidebar-w)] shrink-0 flex-col items-center bg-surface">
      <nav
        aria-label="Primary"
        className="flex w-full flex-1 flex-col items-center gap-1 pt-2"
      >
        {items.map((item) => (
          <NavIcon
            key={item.href}
            item={item}
            active={isNavActive(pathname, item.href)}
            badge={item.href === "/review" ? pending : 0}
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
