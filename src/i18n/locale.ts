import "server-only";
import { db } from "@/lib/db";
import { defaultLocale, isLocale, type Locale } from "./config";

// The wall renders its language from this — and the root layout only renders
// on FULL page loads, which on the kiosk happen once per boot. A single failed
// read here therefore sticks the whole wall to English until the next reload
// (field bug after reboot/update, when Prisma is cold and the Pi is under
// boot load). Retry with backoff before falling back to the default; the
// fallback remains for genuinely-uninitialized first-boot databases.
const READ_ATTEMPTS = 3;
const BACKOFF_MS = [300, 800];

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
