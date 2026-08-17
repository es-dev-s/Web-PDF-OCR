"use client";

import { useEffect, useState } from "react";

export const ACCORDION_MS = 380;

/**
 * Keeps collapsed content mounted for the length of the close animation.
 *
 * `settled` tracks the last value of `open` that has finished animating. While
 * it disagrees with `open` the content stays mounted, so the closing frame is
 * rendered before the element unmounts.
 */
export function useAccordionHold(open: boolean, ms = ACCORDION_MS) {
  const [settled, setSettled] = useState(open);

  useEffect(() => {
    if (open === settled) return;
    if (open) {
      // Opening is immediate; there is nothing to hold on to.
      const frame = window.requestAnimationFrame(() => setSettled(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const timer = window.setTimeout(() => setSettled(false), ms);
    return () => window.clearTimeout(timer);
  }, [open, settled, ms]);

  return open || settled;
}
