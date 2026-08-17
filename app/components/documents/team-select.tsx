"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { filterTeams, findTeam } from "@/app/lib/teams";

type Props = {
  value: string
  onChange: (value: string) => void
};

export function TeamSelect({ value, onChange }: Props) {
  const labelId = useId();
  const listId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [box, setBox] = useState({ top: 0, left: 0, width: 0 });

  // The highlighted row belongs to one particular list. Tying it to that list
  // resets it whenever the list changes, without an effect.
  const listKey = open ? query : "";
  const [highlight, setHighlight] = useState({ key: listKey, index: 0 });
  const active = highlight.key === listKey ? highlight.index : 0;
  const setActive = useCallback(
    (next: number | ((current: number) => number)) => {
      setHighlight((prev) => {
        const current = prev.key === listKey ? prev.index : 0;
        return {
          key: listKey,
          index: typeof next === "function" ? next(current) : next,
        };
      });
    },
    [listKey],
  );
  const selected = findTeam(value);
  const label = selected ?? value.trim();

  const options = useMemo(() => filterTeams(query), [query]);

  const place = () => {
    const node = buttonRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const width = Math.max(rect.width, 18 * 16);
    const left = Math.min(rect.left, window.innerWidth - width - 12);
    const below = rect.bottom + 6;
    const maxH = 20 * 16;
    const top =
      below + maxH > window.innerHeight - 12
        ? Math.max(12, rect.top - maxH - 6)
        : below;
    setBox({ top, left: Math.max(12, left), width });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const frame = window.requestAnimationFrame(() => queryRef.current?.focus());
    const onWin = () => place();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active, options]);

  const pick = (name: string) => {
    const canonical = findTeam(name) ?? name;
    onChange(canonical);
    setQuery("");
    setOpen(false);
    buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((current) => Math.min(current + 1, Math.max(options.length - 1, 0)));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((current) => Math.max(current - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const item = options[active];
        if (!item) return;
        const canonical = findTeam(item) ?? item;
        onChange(canonical);
        setQuery("");
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, options, active, onChange, setActive]);

  const clear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange("");
    setQuery("");
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className="block min-w-0">
      <span id={labelId} className="mb-1.5 block text-[12px] font-medium text-muted">
        Team
      </span>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          aria-labelledby={labelId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => {
            setQuery("");
            setOpen((current) => !current);
          }}
          className={`flex h-9 w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-canvas px-3 text-left text-[13px] text-ink outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] focus:border-[var(--border-strong)] ${
            label ? "pr-14" : "pr-8"
          }`}
        >
          {label ? (
            <span className="min-w-0 flex-1 truncate">{label}</span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-muted-soft">
              Select team
            </span>
          )}
        </button>
        {label ? (
          <button
            type="button"
            aria-label="Clear team"
            onClick={clear}
            className="absolute inset-y-0 right-7 flex items-center px-1 text-muted-soft outline-none hover:text-ink"
          >
            <X className="size-3" strokeWidth={1.75} absoluteStrokeWidth />
          </button>
        ) : null}
        <ChevronDown
          className={`pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted-soft transition-transform duration-[var(--shell-duration)] ease-[var(--shell-ease)] ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={1.75}
          absoluteStrokeWidth
        />
      </div>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={listId}
              role="listbox"
              aria-labelledby={labelId}
              className="fixed z-[80] overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-[var(--shadow-elevated)]"
              style={{
                top: box.top,
                left: box.left,
                width: box.width,
                animation: "popoverIn 160ms var(--shell-ease) both",
              }}
            >
              <div className="border-b border-[var(--border)] p-2">
                <input
                  ref={queryRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search team"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-8 w-full rounded-xl bg-canvas px-3 text-[13px] text-ink outline-none placeholder:text-muted-soft"
                />
              </div>
              <ul className="shell-scroll max-h-64 overflow-y-auto py-1">
                {options.length === 0 ? (
                  <li className="px-3 py-3 text-[13px] text-muted">No matches</li>
                ) : (
                  options.map((name, index) => {
                    const isSelected = name === selected;
                    const isActive = index === active;
                    return (
                      <li key={name}>
                        <button
                          ref={isActive ? activeRef : undefined}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onMouseEnter={() => setActive(index)}
                          onClick={() => pick(name)}
                          className={`flex w-full items-center gap-3 px-3 py-2 text-left outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] ${
                            isActive ? "bg-black/[0.04]" : ""
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                            {name}
                          </span>
                          <span className="flex size-4 shrink-0 items-center justify-center">
                            {isSelected ? (
                              <Check
                                className="size-3.5 text-ink"
                                strokeWidth={1.75}
                                absoluteStrokeWidth
                              />
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
