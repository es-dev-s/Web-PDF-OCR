"use client";

import { useEffect, useRef, useState } from "react";

export const ACCORDION_MS = 380;

export function useAccordionHold(open: boolean, ms = ACCORDION_MS) {
  const [hold, setHold] = useState(open);
  const gen = useRef(0);

  useEffect(() => {
    const n = ++gen.current;
    if (open) {
      setHold(true);
      return;
    }
    const timer = window.setTimeout(() => {
      if (gen.current !== n) return;
      setHold(false);
    }, ms);
    return () => window.clearTimeout(timer);
  }, [open, ms]);

  return open || hold;
}
