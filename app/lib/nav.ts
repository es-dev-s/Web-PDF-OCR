import type { LucideIcon } from "lucide-react";
import { CircleUserRound, File, ScanSearch, Settings } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_PRIMARY: NavItem[] = [
  { href: "/documents", label: "Documents", icon: File },
  { href: "/review", label: "Review", icon: ScanSearch },
  { href: "/user", label: "User", icon: CircleUserRound },
];

export function navForRole(role: string): NavItem[] {
  if (role === "admin") return NAV_PRIMARY;
  return NAV_PRIMARY.filter((item) => item.href !== "/review");
}

export const NAV_FOOTER: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
];

const TITLES: Record<string, string> = {
  "/documents": "Documents",
  "/review": "Review",
  "/user": "User",
  "/settings": "Settings",
};

export function titleForPath(pathname: string): string {
  return TITLES[pathname] ?? "Web OCR";
}

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
