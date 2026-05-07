"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Calendar,
  ChefHat,
  Home,
  Image as ImageIcon,
  ListTodo,
  Settings,
  Star,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { NavItem } from "./nav-item";
import { TopbarClock } from "./topbar-clock";

type NavEntry = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
};

const PRIMARY_NAV: NavEntry[] = [
  { href: "/", labelKey: "dashboard", icon: Home },
  { href: "/calendar", labelKey: "calendar", icon: Calendar },
  { href: "/meals", labelKey: "meals", icon: ChefHat },
  { href: "/chores", labelKey: "chores", icon: Star },
  { href: "/todos", labelKey: "todos", icon: ListTodo },
  { href: "/notes", labelKey: "notes", icon: StickyNote },
];

const SECONDARY_NAV: NavEntry[] = [
  { href: "/photos", labelKey: "photos", icon: ImageIcon },
  { href: "/settings", labelKey: "settings", icon: Settings },
];

const PAGE_TITLE_KEYS: Record<string, string> = {
  "/": "dashboard",
  "/calendar": "calendar",
  "/meals": "meals",
  "/chores": "chores",
  "/todos": "todos",
  "/notes": "notes",
  "/photos": "photos",
  "/settings": "settings",
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname() ?? "/";
  const hideChrome =
    pathname.startsWith("/setup") || pathname.startsWith("/screensaver");

  if (hideChrome) {
    return <>{children}</>;
  }

  function pageTitleFor(p: string): string {
    const key = PAGE_TITLE_KEYS[p];
    if (key) return t(key as Parameters<typeof t>[0]);
    const segment = p.split("/").filter(Boolean)[0];
    if (!segment) return t("dashboard");
    const segKey = PAGE_TITLE_KEYS[`/${segment}`];
    if (segKey) return t(segKey as Parameters<typeof t>[0]);
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  }

  const title = pageTitleFor(pathname);

  return (
    <div className="min-h-dvh bg-bg">
      <aside
        className="hidden md:flex fixed inset-y-0 left-0 z-40 w-60 flex-col border-r border-border bg-surface/60 backdrop-blur-md px-4 py-5"
        aria-label="Primary"
      >
        <div className="px-3 pb-6">
          <span className="font-display text-2xl tracking-tight text-ink">
            FamilyBoard
          </span>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Sidebar">
          {PRIMARY_NAV.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={t(item.labelKey as Parameters<typeof t>[0])}
              icon={item.icon}
              active={isActive(pathname, item.href)}
              variant="sidebar"
            />
          ))}
          <div className="my-3 h-px bg-border" aria-hidden />
          {SECONDARY_NAV.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={t(item.labelKey as Parameters<typeof t>[0])}
              icon={item.icon}
              active={isActive(pathname, item.href)}
              variant="sidebar"
            />
          ))}
        </nav>
        <div className="mt-auto flex items-center justify-between gap-2 px-1 pt-4">
          <span className="text-xs text-muted">{tCommon("theme")}</span>
          <ThemeToggle />
        </div>
      </aside>

      <header
        className={cn(
          "glass sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border px-4 md:pl-64 md:pr-6",
        )}
      >
        <span className="font-display text-lg tracking-tight text-ink md:hidden">
          FamilyBoard
        </span>
        <h1
          className="hidden md:block flex-1 text-center font-display text-base font-medium text-ink"
          aria-live="polite"
        >
          {title}
        </h1>
        <span className="md:hidden flex-1 text-center text-sm font-medium text-ink">
          {title}
        </span>
        <div className="flex items-center gap-2">
          <TopbarClock />
          <ThemeToggle />
        </div>
      </header>

      <main className="md:ml-60 px-4 pt-6 pb-28 md:px-8 md:pb-12">
        {children}
      </main>

      <nav
        className="md:hidden glass fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-1 border-t border-border px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        aria-label="Bottom"
      >
        {PRIMARY_NAV.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={t(item.labelKey as Parameters<typeof t>[0])}
            icon={item.icon}
            active={isActive(pathname, item.href)}
            variant="bottom"
          />
        ))}
      </nav>
    </div>
  );
}
