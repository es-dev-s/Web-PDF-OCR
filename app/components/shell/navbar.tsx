"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { titleForPath } from "@/app/lib/nav";
import {
  NotificationButton,
  ProfileButton,
} from "@/app/components/shell/nav-actions";
import { useDocumentsStore } from "@/app/store/documents-store";
import { isAdmin, useUserStore } from "@/app/store/user-store";

export function Navbar() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="flex h-full min-w-0 flex-1 items-center justify-between gap-3 bg-surface pl-3 pr-2">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="min-w-0 truncate text-[13px] font-medium leading-none tracking-[-0.01em] text-ink">
          {titleForPath(pathname)}
        </h1>
        <ReviewCue pathname={pathname} />
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <NotificationButton />
        <ProfileButton />
      </div>
    </header>
  );
}

function ReviewCue({ pathname }: { pathname: string }) {
  const role = useUserStore((s) => s.role);
  const pending = useDocumentsStore(
    (s) => s.items.filter((item) => item.status === "pending_review").length,
  );
  if (pending === 0) return null;

  const label = pending === 1 ? "1 in review" : `${pending} in review`;
  const className =
    "inline-flex h-6 max-w-[9rem] shrink-0 items-center rounded-full bg-[#f4efe8] px-2 text-[11px] font-medium leading-none text-[#8a5a2b]";

  if (isAdmin(role)) {
    if (pathname === "/review") {
      return <span className={className}>{label}</span>;
    }
    return (
      <Link href="/review" className={`${className} outline-none hover:bg-[#efe6db] focus-visible:ring-2 focus-visible:ring-[var(--ring)]`}>
        {label} · decide
      </Link>
    );
  }

  return <span className={className}>{label}</span>;
}
