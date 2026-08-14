"use client";

import type { ButtonHTMLAttributes, MouseEvent, PointerEvent } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  pressed?: boolean
};

export function IconBtn({
  label,
  pressed,
  className = "",
  onClick,
  onPointerDown,
  children,
  type = "button",
  ...rest
}: Props) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClick?.(event);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onPointerDown?.(event);
  };

  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-muted outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-40 ${
        pressed ? "bg-black/[0.06] text-ink" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}
