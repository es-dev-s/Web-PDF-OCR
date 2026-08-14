import { create } from "zustand";

export type ChromeMenu = "notifications" | "profile";

type ChromeState = {
  menu: ChromeMenu | null
  setMenu: (menu: ChromeMenu | null) => void
};

export const useChromeStore = create<ChromeState>((set) => ({
  menu: null,
  setMenu: (menu) =>
    set((state) => (state.menu === menu ? state : { menu })),
}));
