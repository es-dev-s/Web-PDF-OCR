"use client";

import { usePathname } from "next/navigation";
import { titleForPath } from "@/app/lib/nav";
import {
  NotificationButton,
  ProfileButton,
} from "@/app/components/shell/nav-actions";

export function Navbar() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="flex h-full min-w-0 flex-1 items-center justify-between gap-3 bg-surface pl-3 pr-2">
      <h1 className="min-w-0 truncate text-[13px] font-medium leading-none tracking-[-0.01em] text-ink">
        {titleForPath(pathname)}
      </h1>
      <div className="flex shrink-0 items-center gap-0.5">
        <NotificationButton />
        <ProfileButton />
      </div>
    </header>
  );
}
