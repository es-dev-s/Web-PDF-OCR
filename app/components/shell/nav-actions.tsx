"use client";

import { Bell } from "lucide-react";
import { NotificationPopover } from "@/app/components/shell/notification-popover";
import { ProfilePopover } from "@/app/components/shell/profile-popover";
import { useChromeMenu } from "@/app/hooks/use-chrome-menu";
import { selectHasUnread, useNotificationStore } from "@/app/store/notification-store";
import { useUserStore } from "@/app/store/user-store";

export function NotificationButton() {
  const { anchorRef, open, place, close, toggle } = useChromeMenu(
    "notifications",
    320,
  );
  const hasUnread = useNotificationStore(selectHasUnread);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={hasUnread ? "Notifications, unread" : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notifications"
        onClick={toggle}
        className="relative flex size-8 shrink-0 items-center justify-center rounded-lg text-muted outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <Bell className="size-4" strokeWidth={1.75} absoluteStrokeWidth />
        <span
          className={`absolute top-[7px] right-[8px] size-[6px] rounded-full bg-[#007aff] ring-2 ring-surface ${
            hasUnread ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
      </button>
      <NotificationPopover
        open={open}
        top={place.top}
        right={place.right}
        width={place.width}
        onClose={close}
        anchorRef={anchorRef}
      />
    </>
  );
}

export function ProfileButton() {
  const { anchorRef, open, place, close, toggle } = useChromeMenu("profile", 260);
  const name = useUserStore((s) => s.name);
  const initial = name.trim().charAt(0).toUpperCase() || "U";

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={`Account, ${name}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={name}
        onClick={toggle}
        className="flex h-8 shrink-0 items-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <span className="flex h-7 max-w-[12rem] items-center gap-1.5 rounded-full border border-[var(--border)] bg-surface pl-[3px] pr-2.5">
          <span
            aria-hidden
            className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-black text-[10px] font-semibold leading-none text-white"
          >
            {initial}
          </span>
          <span className="min-w-0 truncate text-[13px] font-medium leading-none tracking-[-0.015em] text-ink">
            {name}
          </span>
        </span>
      </button>
      <ProfilePopover
        open={open}
        top={place.top}
        right={place.right}
        width={place.width}
        onClose={close}
        anchorRef={anchorRef}
      />
    </>
  );
}
