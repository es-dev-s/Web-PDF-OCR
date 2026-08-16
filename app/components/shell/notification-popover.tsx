"use client";

import { useRouter } from "next/navigation";
import { ShellPopover } from "@/app/components/shell/shell-popover";
import {
  unreadCount,
  useNotificationStore,
} from "@/app/store/notification-store";

type Props = {
  open: boolean
  top: number
  right: number
  width: number
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
};

export function NotificationPopover({
  open,
  top,
  right,
  width,
  onClose,
  anchorRef,
}: Props) {
  const router = useRouter();
  const items = useNotificationStore((s) => s.items);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const unread = unreadCount(items);

  return (
    <ShellPopover
      open={open}
      top={top}
      right={right}
      width={width}
      label="Notifications"
      onClose={onClose}
      anchorRef={anchorRef}
    >
      <div className="flex h-10 items-center justify-between px-3.5">
        <p className="text-[13px] font-semibold tracking-[-0.02em] text-ink">
          Notifications
        </p>
        <button
          type="button"
          onClick={markAllRead}
          disabled={unread === 0}
          className={`text-[12px] font-medium outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] ${
            unread > 0
              ? "text-muted hover:text-ink focus-visible:text-ink"
              : "invisible"
          }`}
        >
          Clear
        </button>
      </div>
      <div className="max-h-[min(360px,70vh)] overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-[13px] text-muted">
            You&apos;re all caught up.
          </p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    markRead(item.id);
                    onClose();
                    router.push(item.href);
                  }}
                  className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-surface-muted focus-visible:bg-surface-muted"
                >
                  <span
                    className={`mt-[7px] size-[6px] shrink-0 rounded-full ${
                      item.read ? "bg-transparent" : "bg-[#007aff]"
                    }`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13px] font-medium tracking-[-0.01em] text-ink">
                        {item.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-soft">
                        {item.time}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-4 text-muted">
                      {item.detail}
                    </span>
                    {item.kind === "review" ? (
                      <span className="mt-1.5 inline-flex h-5 items-center rounded-full bg-[#f4efe8] px-1.5 text-[10px] font-medium text-[#8a5a2b]">
                        Open Review
                      </span>
                    ) : item.kind === "review_pending" ? (
                      <span className="mt-1.5 inline-flex h-5 items-center rounded-full bg-[#f4efe8] px-1.5 text-[10px] font-medium text-[#8a5a2b]">
                        Pending
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ShellPopover>
  );
}
