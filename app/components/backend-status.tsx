"use client";

import { useBackendStore } from "@/app/store/backend-store";

export function BackendStatusDot() {
  const status = useBackendStore((s) => s.status);
  const detail = useBackendStore((s) => s.detail);

  const dotClass =
    status === "online"
      ? "bg-emerald-600"
      : status === "connecting"
        ? "bg-[#3b5bcc]"
        : "bg-red-600";

  return (
    <div
      className="flex size-8 shrink-0 items-center justify-center rounded-lg"
      role="status"
      aria-live="polite"
      aria-label={`Backend ${status}`}
      title={detail}
    >
      <span className={`size-1.5 rounded-full ${dotClass}`} />
    </div>
  );
}
