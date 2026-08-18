"use client";

import { useBackendSync } from "@/app/hooks/use-backend-sync";
import { useDataSync } from "@/app/hooks/use-data-sync";
import { LoginScreen } from "@/app/components/auth/login-screen";
import { BrandMark } from "@/app/components/shell/brand-mark";
import { Navbar } from "@/app/components/shell/navbar";
import { Sidebar } from "@/app/components/shell/sidebar";
import { useUserStore } from "@/app/store/user-store";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

function AuthedShell({ children }: { children: React.ReactNode }) {
  useBackendSync();
  useDataSync();

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-surface select-none">
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-[var(--sidebar-w)] top-0 z-30 w-px bg-[var(--border)]"
      />
      <div className="flex h-[var(--navbar-h)] w-full shrink-0 items-stretch border-b border-[var(--border)] bg-surface">
        <BrandMark />
        <Navbar />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1">
        <Sidebar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface select-text">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const publicPage = path.startsWith("/d/");
  const ready = useUserStore((s) => s.ready);
  const signedIn = useUserStore((s) => s.signedIn);
  const hydrate = useUserStore((s) => s.hydrate);

  useEffect(() => {
    if (publicPage) return;
    void hydrate();
  }, [hydrate, publicPage]);

  if (publicPage) {
    return (
      <div className="h-full min-h-0 w-full flex-1 overflow-auto overscroll-contain bg-canvas select-text">
        {children}
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center bg-canvas text-[13px] text-muted">
        Loading…
      </div>
    );
  }
  if (!signedIn) {
    return <LoginScreen />;
  }
  return <AuthedShell>{children}</AuthedShell>;
}
