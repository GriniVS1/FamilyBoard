import "server-only";
import { db } from "@/lib/db";
import { defaultLocale, isLocale, type Locale } from "./config";

export async function getCurrentLocale(): Promise<Locale> {
  try {
    const row = await db.setting.findUnique({ where: { key: "locale" } });
    if (row && isLocale(row.value)) return row.value;
  } catch {
    // DB may not be initialized yet on first boot; fall through to default
  }
  return defaultLocale;
}
