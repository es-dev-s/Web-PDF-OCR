"use client";

import { useCallback, useRef, useState } from "react";
import { useChromeStore, type ChromeMenu } from "@/app/store/chrome-store";

const PAGE_INSET = 8;
const PANEL_GAP = 8;

export function useChromeMenu(id: ChromeMenu, panelWidth: number) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menu = useChromeStore((s) => s.menu);
  const setMenu = useChromeStore((s) => s.setMenu);
  const open = menu === id;
  const [place, setPlace] = useState({
    top: 0,
    right: 0,
    width: panelWidth,
  });

  const close = useCallback(() => {
    if (useChromeStore.getState().menu === id) setMenu(null);
  }, [id, setMenu]);

  const toggle = useCallback(() => {
    if (useChromeStore.getState().menu === id) {
      setMenu(null);
      return;
    }
    const node = anchorRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const width = Math.min(panelWidth, window.innerWidth - PAGE_INSET * 2);
    const right = Math.max(
      PAGE_INSET,
      Math.min(
        window.innerWidth - rect.right,
        window.innerWidth - width - PAGE_INSET,
      ),
    );
    setPlace({ top: rect.bottom + PANEL_GAP, right, width });
    setMenu(id);
  }, [id, panelWidth, setMenu]);

  return { anchorRef, open, place, close, toggle };
}
