"use client";

import { useEffect } from "react";
import {
  BACKEND_CANDIDATES,
  isHealthy,
  type HealthPayload,
} from "@/app/lib/backend";
import { useBackendStore } from "@/app/store/backend-store";

const HEARTBEAT_TIMEOUT_MS = 8000;
const SSE_CONNECT_TIMEOUT_MS = 5000;
const POLL_FAST_MS = 3000;
const POLL_SLOW_MS = 15000;
const MAX_BACKOFF_MS = 15000;

function backoffMs(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
  return Math.round(base * (0.7 + Math.random() * 0.6));
}

async function pollHealth(
  base: string,
  signal: AbortSignal,
): Promise<HealthPayload> {
  const timeout = AbortSignal.timeout(4000);
  const combined = AbortSignal.any([signal, timeout]);
  const response = await fetch(`${base}/health`, {
    method: "GET",
    cache: "no-store",
    signal: combined,
  });
  if (!response.ok) {
    throw new Error(`health ${response.status}`);
  }
  return (await response.json()) as HealthPayload;
}

export function useBackendSync() {
  const setStatus = useBackendStore((s) => s.setStatus);

  useEffect(() => {
    let cancelled = false;
    let eventSource: EventSource | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
    let connectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollAbort: AbortController | null = null;
    let sseAttempt = 0;
    let sseBaseIndex = 0;
    let pollEvery = POLL_FAST_MS;
    let polling = false;
    let sseLive = false;

    const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
      if (timer) clearTimeout(timer);
    };

    const stopPolling = () => {
      polling = false;
      clearTimer(pollTimer);
      pollTimer = null;
      pollAbort?.abort();
      pollAbort = null;
    };

    const closeSse = () => {
      eventSource?.close();
      eventSource = null;
      sseLive = false;
      clearTimer(heartbeatTimer);
      heartbeatTimer = null;
      clearTimer(connectTimer);
      connectTimer = null;
    };

    const setOnline = (payload?: HealthPayload) => {
      if (cancelled) return;
      sseAttempt = 0;
      const uptime =
        typeof payload?.uptime_seconds === "number"
          ? `${Math.floor(payload.uptime_seconds)}s uptime`
          : "connected";
      setStatus("online", `Backend online · ${uptime}`, payload ?? null);
    };

    const setConnecting = (reason: string) => {
      if (cancelled) return;
      setStatus("connecting", reason);
    };

    const setOffline = (reason: string) => {
      if (cancelled) return;
      setStatus("offline", reason, null);
    };

    const armHeartbeat = () => {
      clearTimer(heartbeatTimer);
      heartbeatTimer = setTimeout(() => {
        closeSse();
        setConnecting("Heartbeat lost · reconnecting…");
        startPolling(POLL_FAST_MS);
        scheduleSseReconnect();
      }, HEARTBEAT_TIMEOUT_MS);
    };

    const runPollOnce = async () => {
      pollAbort?.abort();
      pollAbort = new AbortController();
      const { signal } = pollAbort;
      for (const base of BACKEND_CANDIDATES) {
        try {
          const payload = await pollHealth(base, signal);
          if (cancelled || signal.aborted) return;
          if (isHealthy(payload)) {
            setOnline(payload);
            return;
          }
        } catch {
          if (signal.aborted) return;
        }
      }
      if (!cancelled && !sseLive) {
        setOffline("Backend unreachable · retrying…");
      }
    };

    const startPolling = (interval: number) => {
      pollEvery = interval;
      if (polling || cancelled) return;
      polling = true;
      const tick = async () => {
        if (cancelled || !polling) return;
        await runPollOnce();
        if (cancelled || !polling) return;
        pollTimer = setTimeout(tick, pollEvery);
      };
      void tick();
    };

    const scheduleSseReconnect = () => {
      clearTimer(reconnectTimer);
      const delay = backoffMs(sseAttempt);
      sseAttempt += 1;
      reconnectTimer = setTimeout(() => {
        if (!cancelled) connectSse();
      }, delay);
    };

    const connectSse = () => {
      if (cancelled) return;
      if (typeof window.EventSource === "undefined") {
        startPolling(POLL_FAST_MS);
        return;
      }

      closeSse();
      const base = BACKEND_CANDIDATES[sseBaseIndex % BACKEND_CANDIDATES.length];
      const source = new EventSource(`${base}/health/stream`);
      eventSource = source;

      connectTimer = setTimeout(() => {
        if (sseLive) return;
        source.close();
        if (eventSource === source) eventSource = null;
        sseBaseIndex += 1;
        startPolling(POLL_FAST_MS);
        scheduleSseReconnect();
      }, SSE_CONNECT_TIMEOUT_MS);

      source.addEventListener("status", (event: MessageEvent<string>) => {
        if (eventSource !== source) return;
        try {
          const payload = JSON.parse(event.data) as HealthPayload;
          if (!isHealthy(payload)) return;
          sseLive = true;
          clearTimer(connectTimer);
          connectTimer = null;
          setOnline(payload);
          armHeartbeat();
          startPolling(POLL_SLOW_MS);
        } catch {
          // Ignore malformed frames; watchdog / poll will recover.
        }
      });

      source.onerror = () => {
        if (eventSource !== source) return;
        closeSse();
        sseBaseIndex += 1;
        startPolling(POLL_FAST_MS);
        scheduleSseReconnect();
      };
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      void runPollOnce();
      if (!sseLive) connectSse();
    };

    const onBrowserOnline = () => {
      setConnecting("Network back · reconnecting…");
      startPolling(POLL_FAST_MS);
      connectSse();
    };

    const onBrowserOffline = () => {
      closeSse();
      stopPolling();
      setOffline("Browser offline");
    };

    startPolling(POLL_FAST_MS);
    connectSse();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onBrowserOnline);
    window.addEventListener("offline", onBrowserOffline);

    return () => {
      cancelled = true;
      closeSse();
      stopPolling();
      clearTimer(reconnectTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onBrowserOnline);
      window.removeEventListener("offline", onBrowserOffline);
    };
  }, [setStatus]);
}
