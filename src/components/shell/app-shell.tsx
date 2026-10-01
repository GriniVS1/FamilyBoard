"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import {
  ADULT_NAV_ORDER,
  KID_NAV_ORDER,
  NAV_HREF,
  type NavEntryKey,
} from "@/components/shared/nav-icons";
import { ActivationScreen } from "@/components/license/activation-screen";
import { LicenseBanner } from "@/components/license/license-banner";
import { useLicense } from "@/components/license/use-license";
import { UpdateSuccessToast } from "@/components/dashboard/update-success-toast";
import { resolveNavOrder } from "./nav-order";
import { useNavConfig } from "./use-nav-config";
import { MoreSheet } from "./more-sheet";
import { NavTile } from "./nav-item";
import { TopbarClock } from "./topbar-clock";

const BOTTOM_SLOTS = 4;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function entryKeyForPath(pathname: string): NavEntryKey | null {
  const all = [...KID_NAV_ORDER, ...ADULT_NAV_ORDER];
  return all.find((key) => isActive(pathname, NAV_HREF[key])) ?? null;
}

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const t = useTranslations("nav");
  const pathname = usePathname() ?? "/";
  const [moreOpen, setMoreOpen] = useState(false);
  const hideChrome =
    pathname.startsWith("/setup") || pathname.startsWith("/screensaver");

  const { data: license, isLoading: licenseLoading } = useLicense();
  const { data: navConfig, isLoading: navLoading } = useNavConfig();

  if (hideChrome) {
    return <>{children}</>;
  }

  if (licenseLoading || navLoading) {
    return (
      <div className="min-h-dvh bg-bg flex items-center justify-center">
        <Logo />
      </div>
    );
  }

  // Fail-open visually on a transient /api/license error — server still gates writes.
  if (license?.gate === "hard") {
    return <ActivationScreen />;
  }

  // Dashboard and Settings are always present. Children's areas come first;
  // inside each group the saved order and "hide" setting apply.
  const { kids, adults } = resolveNavOrder(navConfig);
  const visible = (items: { key: NavEntryKey; enabled: boolean }[]) =>
    items.filter((item) => item.enabled).map((item) => item.key);
  const kidKeys: NavEntryKey[] = ["dashboard", ...visible(kids)];
  const adultKeys: NavEntryKey[] = [...visible(adults), "settings"];

  const label = (key: NavEntryKey) => t(key as Parameters<typeof t>[0]);
  const activeKey = entryKeyForPath(pathname);

  // "Chores" is pinned to slot 2 by resolveNavOrder; hiding it is the only way out.
  const bottomKeys = kidKeys.slice(0, BOTTOM_SLOTS);
  const moreKeys = [...kidKeys.slice(BOTTOM_SLOTS), ...adultKeys];
  const moreEntries = moreKeys.map((key) => ({
    key,
    href: NAV_HREF[key],
    label: label(key),
    active: key === activeKey,
  }));

  const title = activeKey
    ? label(activeKey)
    : (() => {
        const segment = pathname.split("/").filter(Boolean)[0];
        return segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : label("dashboard");
      })();

  return (
    <div className="min-h-dvh bg-bg">
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-28 flex-col items-center border-r border-border bg-surface/60 backdrop-blur-md md:flex"
        aria-label={t("primary")}
      >
        <div className="flex h-16 shrink-0 items-center justify-center">
          <Logo iconOnly size={34} />
        </div>
        <nav
          className="scrollbar-none flex w-full flex-1 flex-col gap-2 overflow-y-auto px-1 pb-3"
          aria-label={t("sidebar")}
        >
          {kidKeys.map((key) => (
            <NavTile
              key={key}
              href={NAV_HREF[key]}
              label={label(key)}
              navKey={key}
              active={key === activeKey}
              variant="rail"
            />
          ))}
          <div className="mx-3 h-0.5 shrink-0 rounded-full bg-border" aria-hidden />
          {adultKeys.map((key) => (
            <NavTile
              key={key}
              href={NAV_HREF[key]}
              label={label(key)}
              navKey={key}
              active={key === activeKey}
              variant="rail"
            />
          ))}
        </nav>
      </aside>

      <div className="md:ml-28">
        <header
          className={cn(
            "glass sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border px-4 md:px-8",
          )}
        >
          <Logo size={18} className="md:hidden" />
          <h1
            className="kid-title-lg min-w-0 flex-1 truncate text-center text-ink md:text-left"
            aria-live="polite"
          >
            {title}
          </h1>
          <TopbarClock />
        </header>

        <LicenseBanner />
        <UpdateSuccessToast />

        <main className="px-4 pb-28 pt-6 md:px-8 md:pb-12">{children}</main>
      </div>

      <nav
        className="glass fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-2 border-t border-border px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden"
        aria-label={t("bottom")}
      >
        {bottomKeys.map((key) => (
          <NavTile
            key={key}
            href={NAV_HREF[key]}
            label={label(key)}
            navKey={key}
            active={key === activeKey}
            variant="bottom"
          />
        ))}
        <MoreSheet
          open={moreOpen}
          onOpenChange={setMoreOpen}
          entries={moreEntries}
          activeInside={moreKeys.some((key) => key === activeKey)}
        />
      </nav>
    </div>
  );
}
