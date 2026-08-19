"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ListFilter, Search } from "lucide-react";
import { listUsers } from "@/app/lib/api";
import { TEAMS, findTeam } from "@/app/lib/teams";
import {
  peopleFilterActive,
  useDocumentsStore,
  type PeopleKind,
} from "@/app/store/documents-store";
import { isAdmin, useUserStore } from "@/app/store/user-store";

const KINDS: { id: PeopleKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "member", label: "Members" },
  { id: "admin", label: "Admins" },
];

function teamOptions(extra: string[]) {
  const seen = new Set(TEAMS.map((name) => name.toLowerCase()));
  const extraTeams = extra.filter((name) => {
    const key = name.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return extraTeams.length === 0 ? [...TEAMS] : [...TEAMS, ...extraTeams];
}

export function PeopleFilterButton() {
  const role = useUserStore((s) => s.role);
  const userKind = useDocumentsStore((s) => s.userKind);
  const teamFilter = useDocumentsStore((s) => s.teamFilter);
  const setPeopleFilter = useDocumentsStore((s) => s.setPeopleFilter);
  const setUserDirectory = useDocumentsStore((s) => s.setUserDirectory);
  const items = useDocumentsStore((s) => s.items);
  const active = peopleFilterActive(userKind, teamFilter);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ top: 0, right: 0, width: 320 });
  const [draftKind, setDraftKind] = useState<PeopleKind>(userKind);
  const [draftTeam, setDraftTeam] = useState(teamFilter);
  const [teamQuery, setTeamQuery] = useState("");

  const extraTeams = useMemo(() => {
    const names = new Set<string>();
    for (const item of items) {
      const team = findTeam(item.team) ?? item.team.trim();
      if (team) names.add(team);
    }
    return [...names];
  }, [items]);

  const teams = useMemo(() => {
    const q = teamQuery.trim().toLowerCase();
    const all = teamOptions(extraTeams);
    if (!q) return all;
    return all.filter((name) => name.toLowerCase().includes(q));
  }, [extraTeams, teamQuery]);

  const dirty =
    draftKind !== userKind || draftTeam.trim() !== teamFilter.trim();

  useEffect(() => {
    if (!open) return;
    const node = buttonRef.current;
    if (node) {
      const rect = node.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 16);
      const right = Math.max(8, window.innerWidth - rect.right);
      setBox({ top: rect.bottom + 8, right, width });
    }
    setDraftKind(useDocumentsStore.getState().userKind);
    setDraftTeam(useDocumentsStore.getState().teamFilter);
    setTeamQuery("");

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !isAdmin(role)) return;
    const ac = new AbortController();
    void listUsers()
      .then((data) => {
        if (ac.signal.aborted) return;
        setUserDirectory(
          data.items.map((user) => ({
            id: user.id,
            name: user.name,
            role: user.role,
          })),
        );
      })
      .catch(() => {
        if (!ac.signal.aborted) setUserDirectory([]);
      });
    return () => ac.abort();
  }, [open, role, setUserDirectory]);

  const apply = () => {
    setPeopleFilter(draftKind, draftTeam);
    setOpen(false);
  };

  const clear = () => {
    setDraftKind("all");
    setDraftTeam("");
    setPeopleFilter("all", "");
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Filter documents"
        title="Filter"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`relative flex size-8 shrink-0 items-center justify-center rounded-lg outline-none transition-[color,background-color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
          open || active
            ? "bg-black/[0.06] text-ink"
            : "text-muted hover:text-ink"
        }`}
      >
        <ListFilter className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
        {active ? (
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-ink" />
        ) : null}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Filter documents"
              className="fixed z-50 overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-[var(--shadow-elevated)]"
              style={{
                top: box.top,
                right: box.right,
                width: box.width,
                animation: "popoverIn 160ms var(--shell-ease) both",
              }}
            >
              <div className="flex h-10 items-center justify-between px-3.5">
                <p className="text-[13px] font-semibold tracking-[-0.02em] text-ink">
                  Filter
                </p>
                {active || dirty ? (
                  <button
                    type="button"
                    onClick={clear}
                    className="text-[12px] font-medium text-muted outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:text-ink focus-visible:text-ink"
                  >
                    Clear
                  </button>
                ) : (
                  <p className="text-[11px] text-muted-soft">Users and teams</p>
                )}
              </div>
              <div className="h-px bg-[var(--border)]" />
              <div className="px-3.5 pt-3">
                <p className="text-[10px] font-medium tracking-[0.04em] text-muted-soft uppercase">
                  Users
                </p>
                <div className="mt-1.5 grid grid-cols-3 gap-0.5 rounded-xl bg-canvas p-0.5">
                  {KINDS.map((kind) => {
                    const on = draftKind === kind.id;
                    return (
                      <button
                        key={kind.id}
                        type="button"
                        onClick={() => setDraftKind(kind.id)}
                        className={`h-7 rounded-[10px] text-[12px] font-medium outline-none transition-[background-color,color,box-shadow] duration-[var(--shell-duration)] ease-[var(--shell-ease)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                          on
                            ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                            : "text-muted hover:text-ink"
                        }`}
                      >
                        {kind.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="px-3.5 pt-3.5 pb-2">
                <p className="text-[10px] font-medium tracking-[0.04em] text-muted-soft uppercase">
                  Team
                </p>
                <label className="relative mt-1.5 block">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-soft"
                    strokeWidth={1.75}
                    absoluteStrokeWidth
                  />
                  <input
                    ref={queryRef}
                    value={teamQuery}
                    onChange={(event) => setTeamQuery(event.target.value)}
                    placeholder="Search team"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-8 w-full rounded-xl border border-[var(--border)] bg-canvas pr-3 pl-8 text-[13px] text-ink outline-none placeholder:text-muted-soft focus:border-[var(--border-strong)]"
                  />
                </label>
                <ul className="shell-scroll mt-1.5 max-h-52 overflow-y-auto py-0.5">
                  <TeamOption
                    label="All teams"
                    selected={!draftTeam}
                    onPick={() => setDraftTeam("")}
                  />
                  {teams.map((name) => (
                    <TeamOption
                      key={name}
                      label={name}
                      selected={foldEq(draftTeam, name)}
                      onPick={() => setDraftTeam(name)}
                    />
                  ))}
                  {teams.length === 0 ? (
                    <li className="px-2 py-2.5 text-[13px] text-muted">No teams</li>
                  ) : null}
                </ul>
              </div>
              <div className="h-px bg-[var(--border)]" />
              <div className="flex h-12 items-center justify-end px-3.5">
                <button
                  type="button"
                  disabled={!dirty}
                  onClick={apply}
                  className="inline-flex h-8 items-center rounded-xl bg-ink px-3.5 text-[13px] font-medium text-white outline-none transition-[background-color,opacity] duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:bg-ink/30 disabled:text-white"
                >
                  Apply
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function foldEq(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function TeamOption({
  label,
  selected,
  onPick,
}: {
  label: string
  selected: boolean
  onPick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none transition-colors duration-[var(--shell-duration)] ease-[var(--shell-ease)] hover:bg-black/[0.04] focus-visible:bg-black/[0.04] ${
          selected ? "text-ink" : "text-muted"
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-[13px]">{label}</span>
        <span className="flex size-4 shrink-0 items-center justify-center">
          {selected ? (
            <Check className="size-3.5 text-ink" strokeWidth={1.75} absoluteStrokeWidth />
          ) : null}
        </span>
      </button>
    </li>
  );
}
