"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type Window = {
  start: number
  end: number
  padTop: number
  padBottom: number
};

const EMPTY: Window = { start: 0, end: 0, padTop: 0, padBottom: 0 };

export function useVirtualWindow(
  count: number,
  estimate: (index: number) => number,
  overscan = 12,
  revision: string | number = 0,
) {
  const ref = useRef<HTMLDivElement>(null);
  const estimateRef = useRef(estimate);
  estimateRef.current = estimate;
  const [win, setWin] = useState<Window>(EMPTY);

  const recompute = useCallback(() => {
    const el = ref.current;
    const n = count;
    if (!el || n === 0) {
      setWin(
        n === 0
          ? EMPTY
          : { start: 0, end: Math.min(n, 48), padTop: 0, padBottom: 0 },
      );
      return;
    }
    const heights = new Array<number>(n);
    let total = 0;
    for (let i = 0; i < n; i += 1) {
      const h = estimateRef.current(i);
      heights[i] = h;
      total += h;
    }
    const viewTop = el.scrollTop;
    const viewBot = viewTop + el.clientHeight;
    let acc = 0;
    let start = 0;
    while (start < n && acc + heights[start] < viewTop) {
      acc += heights[start];
      start += 1;
    }
    start = Math.max(0, start - overscan);
    let padTop = 0;
    for (let i = 0; i < start; i += 1) padTop += heights[i];
    let end = start;
    acc = padTop;
    while (end < n && acc < viewBot) {
      acc += heights[end];
      end += 1;
    }
    end = Math.min(n, end + overscan);
    let filled = padTop;
    for (let i = start; i < end; i += 1) filled += heights[i];
    setWin({
      start,
      end,
      padTop,
      padBottom: Math.max(0, total - filled),
    });
  }, [count, overscan, revision]);

  useLayoutEffect(() => {
    recompute();
  }, [recompute, count]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => recompute();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [recompute]);

  return { ref, ...win };
}
