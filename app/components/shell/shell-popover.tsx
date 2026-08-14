"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean
  top: number
  right: number
  width: number
  label: string
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  children: React.ReactNode
};

export function ShellPopover({
  open,
  top,
  right,
  width,
  label,
  onClose,
  anchorRef,
  children,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let swallowClick = false;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointer = (event: PointerEvent) => {
      const node = panelRef.current;
      const anchor = anchorRef.current;
      const target = event.target as Node;
      if (node?.contains(target) || anchor?.contains(target)) return;
      swallowClick = true;
      onClose();
    };
    const onClickCapture = (event: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const onScroll = (event: Event) => {
      const node = panelRef.current;
      const target = event.target as Node | null;
      if (node && target && (target === node || node.contains(target))) return;
      onClose();
    };
    const onResize = () => onClose();

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      className="fixed z-50 overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-[var(--shadow-elevated)]"
      style={{
        top,
        right,
        width,
        animation: "popoverIn 160ms var(--shell-ease) both",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
