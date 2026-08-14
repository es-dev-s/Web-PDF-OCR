"use client";

import { ShellPopover } from "@/app/components/shell/shell-popover";
import { useUserStore } from "@/app/store/user-store";

type Props = {
  open: boolean
  top: number
  right: number
  width: number
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
};

export function ProfilePopover({
  open,
  top,
  right,
  width,
  onClose,
  anchorRef,
}: Props) {
  const name = useUserStore((s) => s.name);
  const email = useUserStore((s) => s.email);
  const signedIn = useUserStore((s) => s.signedIn);
  const signOut = useUserStore((s) => s.signOut);
  const initial = name.trim().charAt(0).toUpperCase() || "U";

  const onLogOut = () => {
    onClose();
    signOut();
  };

  return (
    <ShellPopover
      open={open}
      top={top}
      right={right}
      width={width}
      label="Account"
      onClose={onClose}
      anchorRef={anchorRef}
    >
      <div className="px-3.5 pb-3.5 pt-3.5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black text-[15px] font-semibold leading-none text-white"
          >
            {signedIn ? initial : "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold tracking-[-0.02em] text-ink">
              {signedIn ? name : "Signed out"}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-muted">
              {signedIn ? email : "Sign in to continue"}
            </p>
          </div>
        </div>
      </div>
      <div className="h-px bg-[var(--border)]" />
      <button
        type="button"
        onClick={signedIn ? onLogOut : onClose}
        className="flex h-10 w-full items-center px-3.5 text-left text-[13px] font-medium text-red-600 outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-red-50 focus-visible:bg-red-50"
      >
        {signedIn ? "Log Out" : "Close"}
      </button>
    </ShellPopover>
  );
}
