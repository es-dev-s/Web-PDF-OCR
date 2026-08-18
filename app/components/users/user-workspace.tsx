"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CircleUserRound, Plus, RotateCw, Search, X } from "lucide-react";
import {
  createUser,
  listUsers,
  setUserDisabled,
  type ApiUser,
  type AuthRole,
} from "@/app/lib/api";
import { formatDate } from "@/app/lib/dates";
import { useDocumentsStore } from "@/app/store/documents-store";
import { isAdmin, useUserStore } from "@/app/store/user-store";

const COLS =
  "grid-cols-[minmax(10rem,1.3fr)_minmax(10rem,1.25fr)_5.75rem_5.75rem_8.5rem_5.75rem]";

const HEADER_CELL =
  "flex h-9 min-w-0 items-center text-[11px] font-medium tracking-[0.05em] text-muted uppercase";

const ROW_CELL = "flex min-h-14 min-w-0 items-center py-2.5";

export function UserWorkspace() {
  const role = useUserStore((s) => s.role);
  if (isAdmin(role)) return <AdminUsers />;
  return <MemberProfile />;
}

function MemberProfile() {
  const name = useUserStore((s) => s.name);
  const email = useUserStore((s) => s.email);
  const role = useUserStore((s) => s.role);
  const pending = useDocumentsStore(
    (s) => s.items.filter((item) => item.status === "pending_review").length,
  );
  const initial = name.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-auto overscroll-contain">
      <div className="sticky top-0 z-10 flex h-[var(--toolbar-h)] shrink-0 items-center border-b border-[var(--border)] bg-surface px-4">
        <p className="text-[13px] font-medium tracking-[-0.015em] text-ink">Account</p>
      </div>
      <div className="mx-auto w-full max-w-lg px-5 py-8 sm:px-8">
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface">
          <div className="flex items-center gap-3 px-4 py-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-ink">
                {name}
              </p>
              <p className="truncate text-[12px] text-muted">{email}</p>
            </div>
          </div>
          <div className="h-px bg-[var(--border)]" />
          <Fact title="Role" value={role === "admin" ? "Admin" : "Member"} />
          <div className="h-px bg-[var(--border)]" />
          <Fact title="Access" value="Your uploads only" />
          <div className="h-px bg-[var(--border)]" />
          <Fact
            title="Review"
            value={
              pending === 0
                ? "None waiting"
                : pending === 1
                  ? "1 document on hold"
                  : `${pending} documents on hold`
            }
          />
        </div>
        <p className="mt-4 text-[12px] leading-5 text-muted">
          Duplicate uploads stay on Documents as Pending until an admin reviews them. You’ll get a notification when they’re decided.
        </p>
      </div>
    </div>
  );
}

function Fact({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex h-12 items-center justify-between gap-4 px-4">
      <p className="text-[13px] text-muted">{title}</p>
      <p className="truncate text-[13px] font-medium text-ink">{value}</p>
    </div>
  );
}

function AdminUsers() {
  const selfId = useUserStore((s) => s.id);
  const [items, setItems] = useState<ApiUser[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");

  const refresh = useCallback(async () => {
    const { items } = await listUsers();
    setItems(items);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { items } = await listUsers();
        if (alive) setItems(items);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onDisable = async (user: ApiUser) => {
    if (user.id === selfId || busyId) return;
    setBusyId(user.id);
    setActionError("");
    try {
      await setUserDisabled(user.id, !user.disabled);
      await refresh();
    } catch {
      setActionError("Couldn’t update that account. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((user) =>
      [user.name, user.email, user.role].join(" ").toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-auto overscroll-contain">
      <div className="sticky top-0 z-10 flex h-[var(--toolbar-h)] shrink-0 items-center gap-3 overflow-hidden border-b border-[var(--border)] bg-surface px-4 [contain:layout]">
        <label className="relative block min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-soft"
            strokeWidth={1.75}
            absoluteStrokeWidth
          />
          <input
            type="text"
            inputMode="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            autoComplete="off"
            spellCheck={false}
            className="h-8 w-full rounded-xl border border-[var(--border)] bg-canvas pr-3 pl-8 text-[13px] text-ink outline-none placeholder:text-muted-soft focus:border-[var(--border-strong)]"
          />
        </label>
        <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          <span className="inline-flex h-8 w-[7.5rem] shrink-0 items-center text-[12px] leading-none tabular-nums text-muted">
            {visible.length} {visible.length === 1 ? "row" : "rows"}
          </span>
          {actionError ? (
            <span className="max-w-[16rem] truncate text-[12px] text-red-600" title={actionError}>
              {actionError}
            </span>
          ) : null}
          <button
            type="button"
            aria-label="Reload"
            title="Reload"
            onClick={() => {
              setLoading(true);
              void refresh().finally(() => setLoading(false));
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <span className={`flex size-3.5 items-center justify-center ${loading ? "reload-spin" : ""}`}>
              <RotateCw className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
            </span>
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-8 w-[9.75rem] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-ink px-4 text-[13px] font-medium tracking-[-0.015em] text-white outline-none hover:bg-black focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:w-[11.5rem] md:w-[13rem]"
          >
            <Plus className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
            <span>Add user</span>
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-canvas text-muted">
            <CircleUserRound className="size-5" strokeWidth={1.75} absoluteStrokeWidth />
          </span>
          <p className="mt-4 text-[15px] font-semibold tracking-[-0.02em] text-ink">
            {query.trim() ? "No matches" : "No users yet"}
          </p>
          <p className="mt-1 max-w-sm text-[13px] leading-5 text-muted">
            {query.trim()
              ? "No users match this search."
              : "Add a member so they can sign in and upload. They only see their own documents."}
          </p>
        </div>
      ) : (
        <div className="w-full min-w-[48rem]" role="table" aria-label="Users">
          <div
            className={`sticky top-[var(--toolbar-h)] z-[9] grid ${COLS} gap-x-4 border-b border-[var(--border)] bg-surface px-4`}
            role="row"
          >
            <div className={HEADER_CELL}>Name</div>
            <div className={HEADER_CELL}>Email</div>
            <div className={HEADER_CELL}>Role</div>
            <div className={HEADER_CELL}>Status</div>
            <div className={HEADER_CELL}>Added</div>
            <div className={`${HEADER_CELL} justify-end`}>Action</div>
          </div>
          <div role="rowgroup">
            {visible.map((user) => {
              const initial = user.name.trim().charAt(0).toUpperCase() || "U";
              return (
                <div
                  key={user.id}
                  className={`grid ${COLS} gap-x-4 border-b border-[var(--border)] px-4 hover:bg-surface-muted`}
                  role="row"
                >
                  <div className={ROW_CELL} role="cell">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">
                      {initial}
                    </span>
                    <span className="ml-2.5 min-w-0 truncate text-[13px] font-medium tracking-[-0.01em] text-ink">
                      {user.name}
                      {user.id === selfId ? (
                        <span className="ml-1.5 font-normal text-muted">you</span>
                      ) : null}
                    </span>
                  </div>
                  <div className={ROW_CELL} role="cell">
                    <p className="min-w-0 w-full truncate text-[13px] text-muted">{user.email}</p>
                  </div>
                  <div className={ROW_CELL} role="cell">
                    <p className="min-w-0 w-full truncate text-[13px] text-ink">
                      {user.role === "admin" ? "Admin" : "Member"}
                    </p>
                  </div>
                  <div className={ROW_CELL} role="cell">
                    <p className={`min-w-0 w-full truncate text-[13px] ${user.disabled ? "text-muted" : "text-ink"}`}>
                      {user.disabled ? "Disabled" : "Active"}
                    </p>
                  </div>
                  <div className={ROW_CELL} role="cell">
                    <p className="min-w-0 w-full truncate text-[13px] tabular-nums text-muted">
                      {user.created_at ? formatDate(user.created_at) : "—"}
                    </p>
                  </div>
                  <div className={`${ROW_CELL} justify-end`} role="cell">
                    <div className="flex w-full min-w-0 items-center justify-end">
                      {user.id === selfId ? (
                        <span className="inline-flex h-7 w-[4.75rem] items-center justify-center text-[12px] text-muted-soft">
                          —
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === user.id}
                          onClick={() => void onDisable(user)}
                          className="inline-flex h-7 w-[4.75rem] shrink-0 items-center justify-center rounded-lg text-[12px] font-medium text-muted outline-none hover:bg-black/[0.06] hover:text-ink disabled:opacity-40"
                        >
                          {user.disabled ? "Enable" : "Disable"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AddUserDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => void refresh()}
      />
    </div>
  );
}

// Mounting the form only while the dialog is open gives every visit a blank
// form, so there is nothing to reset when it closes.
function AddUserDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  if (!open || typeof document === "undefined") return null;
  return <AddUserForm onClose={onClose} onCreated={onCreated} />;
}

function AddUserForm({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const titleId = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AuthRole>("member");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await createUser({ name: name.trim(), email: email.trim(), password, role });
      onCreated();
      onClose();
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      setError(code === "email_taken" ? "Email is already in use" : "Couldn’t create user");
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/20"
        style={{ animation: "backdropIn 160ms var(--shell-ease) both" }}
        onClick={onClose}
      />
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] w-full max-w-[24rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-[var(--shadow-elevated)]"
        style={{ animation: "popoverIn 180ms var(--shell-ease) both" }}
      >
        <div className="flex h-12 items-center justify-between px-5">
          <h2 id={titleId} className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
            Add user
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-muted outline-none hover:bg-black/[0.06] hover:text-ink"
          >
            <X className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
          </button>
        </div>
        <div className="h-px bg-[var(--border)]" />
        <div className="grid gap-3 px-5 py-4">
          <Field label="Name" value={name} onChange={setName} required autoFocus />
          <Field label="Email" value={email} onChange={setEmail} type="email" required />
          <Field label="Password" value={password} onChange={setPassword} type="password" required minLength={8} />
          <label className="block min-w-0">
            <span className="mb-1.5 block text-[12px] font-medium text-muted">Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as AuthRole)}
              className="h-9 w-full rounded-xl border border-[var(--border)] bg-canvas px-3 text-[13px] text-ink outline-none focus:border-[var(--border-strong)]"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <p className={`h-4 text-[12px] ${error ? "text-red-600" : "text-transparent"}`}>
            {error || "placeholder"}
          </p>
        </div>
        <div className="h-px bg-[var(--border)]" />
        <div className="flex h-14 items-center justify-end gap-2 px-5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-xl px-3 text-[13px] font-medium text-muted outline-none hover:bg-black/[0.06] hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-8 items-center rounded-xl bg-ink px-4 text-[13px] font-medium text-white outline-none hover:bg-black disabled:bg-ink/30"
          >
            {busy ? "Adding…" : "Add user"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  minLength,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  minLength?: number
  autoFocus?: boolean
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[12px] font-medium text-muted">{label}</span>
      <input
        type={type}
        required={required}
        minLength={minLength}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        className="h-9 w-full rounded-xl border border-[var(--border)] bg-canvas px-3 text-[13px] text-ink outline-none focus:border-[var(--border-strong)]"
      />
    </label>
  );
}
