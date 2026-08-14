import { create } from "zustand";

export const LOGGED_IN_USER = {
  name: "Pawan",
  handle: "pawan",
  email: "pawan@ocr.app",
} as const;

type UserState = {
  signedIn: boolean
  name: string
  handle: string
  email: string
  signOut: () => void
};

export const useUserStore = create<UserState>((set) => ({
  signedIn: true,
  name: LOGGED_IN_USER.name,
  handle: LOGGED_IN_USER.handle,
  email: LOGGED_IN_USER.email,
  signOut: () => set({ signedIn: false }),
}));
