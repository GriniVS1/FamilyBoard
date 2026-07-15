import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { defaultLocale, isLocale, type Locale } from "./config";

// Last-known-good locale, mirrored into a cookie by /api/settings/locale.
// The wall reads THIS (not the DB) at render time — see resolveLocaleForRequest.
export const LOCALE_COOKIE = "fb_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// The wall renders its language from this — and the root layout only renders
// on FULL page loads, which on the kiosk happen once per boot. A single failed
// read here therefore sticks the whole wall to English until the next reload
// (field bug after reboot/update, when Prisma is cold and the Pi is under
// boot load). Retry with backoff before falling back to the default; the
// fallback remains for genuinely-uninitialized first-boot databases.
//
// The budget is deliberately generous (~5s worst case): after an OTA update
// Next's version-skew handling reloads the kiosk page the moment the NEW
// server starts listening — before the updater's health gate has even passed —
// so this read races a stone-cold Prisma engine under docker-load pressure.
// LocaleGuard (client) is the second net if we still lose that race.
const READ_ATTEMPTS = 5;
const BACKOFF_MS = [300, 800, 1500, 2500];

// DB-only read. Used by non-request contexts (push scheduler via
// notification-i18n) and as the source of truth by /api/settings/locale.
export async function getCurrentLocale(): Promise<Locale> {
  for (let attempt = 0; attempt < READ_ATTEMPTS; attempt++) {
    try {
      const row = await db.setting.findUnique({ where: { key: "locale" } });
      if (row && isLocale(row.value)) return row.value;
      return defaultLocale; // read succeeded, nothing configured yet
    } catch {
      if (attempt < READ_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
      }
    }
  }
  return defaultLocale;
}

// Request-scoped resolver for RENDERING (root layout + next-intl request
// config). Reads the fb_locale cookie FIRST — this is the fix for the wall
// reverting to English after an OTA: the cookie carries the last-known-good
// locale, so a full page reload never has to win a race against a cold Prisma
// engine, and reading cookies() forces the layout to render dynamically (no
// stale English render served from Next's cache). Falls back to the DB only
// when no valid cookie exists yet (genuine first boot); the cookie is written
// by /api/settings/locale, which the client polls.
export async function resolveLocaleForRequest(): Promise<Locale> {
  try {
    const cookieValue = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (cookieValue && isLocale(cookieValue)) return cookieValue;
  } catch {
    // cookies() unavailable — fall through to the DB read
  }
  return getCurrentLocale();
}
