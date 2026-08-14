export const SAME_ORIGIN_BACKEND = "/backend";
export const DIRECT_BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8001";

export const BACKEND_CANDIDATES = Array.from(
  new Set([SAME_ORIGIN_BACKEND, DIRECT_BACKEND]),
);

export type HealthChecks = {
  postgres?: string
  redis?: string
  storage?: string
  storage_driver?: string
  engine?: string
};

export type HealthPayload = {
  ok?: boolean
  status?: string
  ready?: boolean
  service?: string
  uptime_seconds?: number
  timestamp?: string
  checks?: HealthChecks
};

export function isHealthy(payload: HealthPayload | null): boolean {
  if (!payload) return false;
  if (payload.ok === true) return true;
  return payload.status === "ok" || payload.status === "degraded";
}
