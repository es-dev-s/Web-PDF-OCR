"use client";

import type { ReactNode } from "react";
import { BackendStatusDot } from "@/app/components/backend-status";
import { useBackendStore } from "@/app/store/backend-store";

function labelFor(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  if (value === "ok") return "Connected";
  if (value === "down") return "Disconnected";
  if (value === "off") return "Not configured";
  if (value === "local") return "Local disk";
  return value;
}

function Row({
  title,
  subtitle,
  value,
  trailing,
}: {
  title: string
  subtitle: string
  value: string
  trailing?: ReactNode
}) {
  return (
    <div className="flex h-12 items-center justify-between gap-4 px-4">
      <div className="min-w-0">
        <p className="text-[13px] font-medium tracking-[-0.01em] text-ink">
          {title}
        </p>
        <p className="truncate text-[11px] text-muted-soft">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-[12px] capitalize text-muted sm:inline">
          {value}
        </span>
        {trailing}
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const status = useBackendStore((s) => s.status);
  const health = useBackendStore((s) => s.health);
  const online = status === "online";
  const postgres = online ? health?.checks?.postgres : "down";
  const redis = online ? health?.checks?.redis : "down";
  const storage = online ? health?.checks?.storage : "down";
  const driver = health?.checks?.storage_driver ?? "local";

  return (
    <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-lg">
      <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
        Settings
      </h2>
      <p className="mt-3 text-[12px] font-medium uppercase tracking-[0.08em] text-muted-soft">
        System
      </p>
      <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-surface">
        <Row
          title="Backend"
          subtitle="Live connection"
          value={status}
          trailing={<BackendStatusDot />}
        />
        <div className="h-px bg-[var(--border)]" />
        <Row
          title="PostgreSQL"
          subtitle="Primary database"
          value={labelFor(postgres, "Checking")}
        />
        <div className="h-px bg-[var(--border)]" />
        <Row
          title="Redis"
          subtitle="Realtime and cache"
          value={labelFor(redis, "Checking")}
        />
        <div className="h-px bg-[var(--border)]" />
        <Row
          title="Storage"
          subtitle={driver === "local" ? "Local disk" : driver}
          value={
            storage === "ok"
              ? labelFor(driver, "Local disk")
              : labelFor(storage, "Checking")
          }
        />
        <div className="h-px bg-[var(--border)]" />
        <Row
          title="Engine"
          subtitle="PDF title extraction"
          value={labelFor(online ? health?.checks?.engine : "down", "Checking")}
        />
      </div>
      </div>
    </div>
  );
}
