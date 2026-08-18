"use client";

import { useEffect } from "react";
import {
  eventsUrl,
  type ApiDocument,
  type ApiNotification,
  type LiveEvent,
} from "@/app/lib/api";
import { useBackendStore } from "@/app/store/backend-store";
import {
  mapDocument,
  useDocumentsStore,
} from "@/app/store/documents-store";
import {
  mapNotification,
  useNotificationStore,
} from "@/app/store/notification-store";
import { useUserStore } from "@/app/store/user-store";

function reconnectDelay(attempt: number) {
  const base = Math.min(1000 * 2 ** attempt, 15_000);
  return Math.round(base * (0.7 + Math.random() * 0.6));
}

function applyEvent(payload: LiveEvent) {
  if (payload.type === "document.created" || payload.type === "document.updated") {
    useDocumentsStore.getState().upsert(mapDocument(payload.data as ApiDocument));
    return;
  }
  if (payload.type === "document.deleted") {
    const id = (payload.data as { id?: string } | undefined)?.id;
    if (id) useDocumentsStore.getState().dropLocal(id);
    return;
  }
  if (payload.type === "notification.created" || payload.type === "notification.updated") {
    const note = payload.data as ApiNotification;
    const role = useUserStore.getState().role;
    if (note.audience === "admin" && role !== "admin") return;
    useNotificationStore.getState().upsert(mapNotification(note));
    return;
  }
  if (payload.type === "notification.cleared") {
    void useNotificationStore.getState().refresh();
  }
}

function needsCatchup() {
  return useDocumentsStore.getState().items.some(
    (item) =>
      item.status === "processing" ||
      item.status === "pending_review" ||
      item.titlePending,
  );
}

export function useDataSync() {
  const status = useBackendStore((s) => s.status);

  useEffect(() => {
    if (status !== "online") return;
    void useDocumentsStore.getState().refresh();
    void useNotificationStore.getState().refresh();
  }, [status]);

  useEffect(() => {
    if (status !== "online") return;
    if (typeof window.EventSource === "undefined") {
      const poll = window.setInterval(() => {
        void useDocumentsStore.getState().refresh();
        void useNotificationStore.getState().refresh();
      }, 4000);
      return () => window.clearInterval(poll);
    }

    let stopped = false;
    let attempt = 0;
    let timer = 0;
    let pollTimer = 0;
    let source: EventSource | null = null;
    let live = false;
    let lastEvent = 0;

    const refreshAll = () => {
      void useDocumentsStore.getState().refresh();
      void useNotificationStore.getState().refresh();
    };

    const schedulePoll = () => {
      if (pollTimer) window.clearTimeout(pollTimer);
      const wait = !live || needsCatchup() ? 4000 : 20000;
      pollTimer = window.setTimeout(() => {
        if (stopped) return;
        if (!live || needsCatchup() || Date.now() - lastEvent > 25000) {
          refreshAll();
        }
        schedulePoll();
      }, wait);
    };

    const onPayload = (event: MessageEvent<string>) => {
      lastEvent = Date.now();
      live = true;
      attempt = 0;
      try {
        applyEvent(JSON.parse(event.data) as LiveEvent);
      } catch {
        // Ignore malformed frames.
      }
    };

    let opened = false;

    const connect = () => {
      if (stopped) return;
      if (timer) {
        window.clearTimeout(timer);
        timer = 0;
      }
      source?.close();
      const next = new EventSource(eventsUrl(), { withCredentials: true });
      source = next;
      next.addEventListener("hello", () => {
        live = true;
        attempt = 0;
        lastEvent = Date.now();
      });
      next.addEventListener("message", onPayload);
      next.onopen = () => {
        live = true;
        attempt = 0;
        lastEvent = Date.now();
        if (opened) refreshAll();
        opened = true;
      };
      next.onerror = () => {
        next.removeEventListener("message", onPayload);
        next.close();
        if (source === next) source = null;
        live = false;
        if (stopped) return;
        refreshAll();
        const delay = reconnectDelay(attempt);
        attempt += 1;
        timer = window.setTimeout(connect, delay);
      };
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      refreshAll();
      if (!live && !stopped) connect();
    };

    connect();
    schedulePoll();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refreshAll);

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      if (pollTimer) window.clearTimeout(pollTimer);
      source?.close();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refreshAll);
    };
  }, [status]);
}
