"use client";

import { useEffect, useRef } from "react";
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

export function useDataSync() {
  const status = useBackendStore((s) => s.status);
  const refreshDocs = useDocumentsStore((s) => s.refresh);
  const upsertDoc = useDocumentsStore((s) => s.upsert);
  const refreshNotes = useNotificationStore((s) => s.refresh);
  const upsertNote = useNotificationStore((s) => s.upsert);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (status !== "online") return;
    void refreshDocs();
    void refreshNotes();
  }, [status, refreshDocs, refreshNotes]);

  useEffect(() => {
    if (status !== "online") {
      sourceRef.current?.close();
      sourceRef.current = null;
      return;
    }
    if (typeof window.EventSource === "undefined") return;

    const source = new EventSource(eventsUrl());
    sourceRef.current = source;

    const onMessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as LiveEvent;
        if (payload.type === "document.created" || payload.type === "document.updated") {
          upsertDoc(mapDocument(payload.data as ApiDocument));
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
          upsertNote(mapNotification(note));
          return;
        }
        if (payload.type === "notification.cleared") {
          void refreshNotes();
        }
      } catch {
        // Ignore malformed frames.
      }
    };

    source.addEventListener("message", onMessage);
    source.onerror = () => {
      source.close();
      if (sourceRef.current === source) sourceRef.current = null;
    };

    return () => {
      source.removeEventListener("message", onMessage);
      source.close();
      if (sourceRef.current === source) sourceRef.current = null;
    };
  }, [status, upsertDoc, upsertNote, refreshNotes]);
}
