"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";

// Self-heal for the "wall stuck in English" failure mode: the root layout
// resolves the locale from the DB exactly once per full page load. If that
// read loses the race against a cold Prisma engine (boot, or the reload
// Next's version-skew handling forces right after an OTA update), the page
// silently renders the default locale — and since the kiosk never reloads
// on its own, the wrong language sticks for good.
//
// This guard compares the locale the page was RENDERED with against what the
// server says once it's healthy, and hard-reloads on mismatch. Loop-safe:
// it only reloads on a VALID differing answer (server errors never trigger
// it), and at most once per minute (sessionStorage survives reloads).

const CHECK_DELAY_MS = 5_000; // first check, after the page settled
const CHECK_INTERVAL_MS = 60_000;
const MIN_RELOAD_GAP_MS = 60_000;
const RELOAD_STAMP_KEY = "locale-guard-last-reload";

export function LocaleGuard() {
  const renderedLocale = useLocale();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      let serverLocale: string | null = null;
      try {
        const res = await fetch("/api/settings/locale", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { locale?: string };
        if (typeof data.locale === "string" && data.locale.length > 0) {
          serverLocale = data.locale;
        }
      } catch {
        return; // server unreachable/unhealthy — never reload on errors
      }
      if (cancelled || !serverLocale || serverLocale === renderedLocale) return;

      let last = 0;
      try {
        last = Number(sessionStorage.getItem(RELOAD_STAMP_KEY) ?? 0);
      } catch {
        // storage unavailable — still allow the reload
      }
      if (Date.now() - last < MIN_RELOAD_GAP_MS) return;
      try {
        sessionStorage.setItem(RELOAD_STAMP_KEY, String(Date.now()));
      } catch {
        // ignore
      }
      window.location.reload();
    }

    const first = setTimeout(check, CHECK_DELAY_MS);
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [renderedLocale]);

  return null;
}
