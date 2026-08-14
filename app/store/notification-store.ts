import { create } from "zustand";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type ApiNotification,
} from "@/app/lib/api";
import { formatRelative } from "@/app/lib/dates";

export type AppNotification = {
  id: string
  title: string
  detail: string
  time: string
  read: boolean
};

type NotificationState = {
  items: AppNotification[]
  replaceAll: (items: AppNotification[]) => void
  upsert: (item: AppNotification) => void
  refresh: () => Promise<void>
  markRead: (id: string) => void
  markAllRead: () => void
};

const EMPTY: AppNotification[] = [];

export function mapNotification(raw: ApiNotification): AppNotification {
  return {
    id: raw.id,
    title: raw.title,
    detail: raw.detail,
    time: formatRelative(raw.created_at),
    read: raw.read,
  };
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: EMPTY,
  replaceAll: (items) => set({ items }),
  upsert: (item) =>
    set((state) => {
      const index = state.items.findIndex((current) => current.id === item.id);
      if (index === -1) return { items: [item, ...state.items] };
      return {
        items: state.items.map((current) =>
          current.id === item.id ? item : current,
        ),
      };
    }),
  refresh: async () => {
    try {
      const { items } = await listNotifications();
      get().replaceAll(items.map(mapNotification));
    } catch {
      // Heartbeat owns connection state.
    }
  },
  markRead: (id) => {
    const current = get().items.find((item) => item.id === id);
    if (!current || current.read) return;
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, read: true } : item,
      ),
    }));
    void markNotificationRead(id).catch(() => {
      void get().refresh();
    });
  },
  markAllRead: () => {
    if (get().items.every((item) => item.read)) return;
    set((state) => ({
      items: state.items.map((item) =>
        item.read ? item : { ...item, read: true },
      ),
    }));
    void markAllNotificationsRead().catch(() => {
      void get().refresh();
    });
  },
}));

export function unreadCount(items: AppNotification[]): number {
  return items.reduce((n, item) => (item.read ? n : n + 1), 0);
}

export function selectHasUnread(state: NotificationState): boolean {
  return state.items.some((item) => !item.read);
}
