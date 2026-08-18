import { create } from "zustand";
import {
  currentUser,
  login as apiLogin,
  logout as apiLogout,
  type ApiUser,
  type AuthRole,
} from "@/app/lib/api";

type UserState = {
  ready: boolean
  signedIn: boolean
  id: string
  name: string
  handle: string
  email: string
  role: AuthRole | ""
  hydrate: () => Promise<void>
  signIn: (email: string, password: string) => Promise<"ok" | "auth" | "disabled" | "rate" | "error">
  signOut: () => Promise<void>
  clear: () => void
};

const EMPTY: Omit<UserState, "ready" | "signedIn" | "hydrate" | "signIn" | "signOut" | "clear"> = {
  id: "",
  name: "",
  handle: "",
  email: "",
  role: "",
};

function applyUser(user: ApiUser) {
  return {
    ready: true,
    signedIn: true,
    id: user.id,
    name: user.name,
    handle: user.email.split("@")[0] ?? user.name,
    email: user.email,
    role: user.role,
  };
}

export const useUserStore = create<UserState>((set, get) => ({
  ready: false,
  signedIn: false,
  ...EMPTY,
  hydrate: async () => {
    try {
      const { user } = await currentUser();
      set(applyUser(user));
    } catch {
      set({ ready: true, signedIn: false, ...EMPTY });
    }
  },
  signIn: async (email, password) => {
    try {
      const { user } = await apiLogin(email.trim(), password);
      set(applyUser(user));
      return "ok";
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code === "unauthorized") return "auth";
      if (code === "disabled") return "disabled";
      if (code === "rate_limited") return "rate";
      return "error";
    }
  },
  signOut: async () => {
    try {
      await apiLogout();
    } catch {
      // Cookie clear is best-effort.
    }
    get().clear();
    const { useDocumentsStore } = await import("@/app/store/documents-store");
    const { useNotificationStore } = await import("@/app/store/notification-store");
    useDocumentsStore.getState().resetSession();
    useNotificationStore.getState().replaceAll([]);
  },
  clear: () => set({ ready: true, signedIn: false, ...EMPTY }),
}));

export function onUnauthorized() {
  const state = useUserStore.getState();
  if (!state.signedIn) return;
  state.clear();
  void import("@/app/store/documents-store").then(({ useDocumentsStore }) => {
    useDocumentsStore.getState().resetSession();
  });
  void import("@/app/store/notification-store").then(({ useNotificationStore }) => {
    useNotificationStore.getState().replaceAll([]);
  });
}

export function isAdmin(role: string) {
  return role === "admin";
}
