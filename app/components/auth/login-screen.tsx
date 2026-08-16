"use client";

import { useState } from "react";
import { useUserStore } from "@/app/store/user-store";

export function LoginScreen() {
  const signIn = useUserStore((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await signIn(email, password);
    setBusy(false);
    if (result === "ok") return;
    setError(result === "auth" ? "Invalid email or password" : "Couldn’t sign in. Try again.");
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center bg-canvas p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[22rem] rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-[var(--shadow-soft)]"
      >
        <p className="text-[11px] font-medium tracking-[0.08em] text-muted-soft uppercase">
          Web OCR
        </p>
        <h1 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-ink">
          Sign in
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">
          Use your admin or member account.
        </p>
        <label className="mt-5 block">
          <span className="mb-1.5 block text-[12px] font-medium text-muted">Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-9 w-full rounded-xl border border-[var(--border)] bg-canvas px-3 text-[13px] text-ink outline-none placeholder:text-muted-soft focus:border-[var(--border-strong)]"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-[12px] font-medium text-muted">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-9 w-full rounded-xl border border-[var(--border)] bg-canvas px-3 text-[13px] text-ink outline-none focus:border-[var(--border-strong)]"
          />
        </label>
        <p className={`mt-2 h-4 text-[12px] ${error ? "text-red-600" : "text-transparent"}`}>
          {error || "placeholder"}
        </p>
        <button
          type="submit"
          disabled={busy}
          className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-xl bg-ink text-[13px] font-medium text-white outline-none hover:bg-black focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:bg-ink/30"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
