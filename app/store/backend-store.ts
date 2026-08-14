import { create } from "zustand";
import type { HealthPayload } from "@/app/lib/backend";

export type ConnectionStatus = "connecting" | "online" | "offline";

type BackendState = {
  status: ConnectionStatus
  detail: string
  health: HealthPayload | null
  setStatus: (
    status: ConnectionStatus,
    detail: string,
    health?: HealthPayload | null,
  ) => void
};

export const useBackendStore = create<BackendState>((set) => ({
  status: "connecting",
  detail: "Checking backend…",
  health: null,
  setStatus: (status, detail, health) =>
    set((state) => {
      const nextHealth = health === undefined ? state.health : health;
      if (
        state.status === status &&
        healthEqual(state.health, nextHealth)
      ) {
        if (status === "online") return state;
        if (state.detail === detail) return state;
      }
      return { status, detail, health: nextHealth };
    }),
}));

function healthEqual(a: HealthPayload | null, b: HealthPayload | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.status === b.status &&
    a.ready === b.ready &&
    a.checks?.postgres === b.checks?.postgres &&
    a.checks?.redis === b.checks?.redis &&
    a.checks?.storage === b.checks?.storage &&
    a.checks?.storage_driver === b.checks?.storage_driver
  );
}
