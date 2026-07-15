import { z } from "zod";
import { cookies } from "next/headers";
import { ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  getCurrentLocale,
} from "@/i18n/locale";
import { locales } from "@/i18n/config";
import { requireAdminPin } from "@/lib/admin-pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Persist the resolved locale into the fb_locale cookie so the root layout
// renders from it (race-free, cache-busting) instead of racing the DB. The
// client polls GET, which keeps the cookie fresh with the DB's truth.
async function syncCookie(locale: string): Promise<void> {
  try {
    (await cookies()).set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
    });
  } catch {
    // cookies() not writable in this context — best-effort
  }
}

export const GET = withErrorHandling(async () => {
  const locale = await getCurrentLocale();
  await syncCookie(locale);
  return ok({ locale });
});

const PatchBody = z.object({
  locale: z.enum(locales),
});

export const PATCH = withErrorHandling(async (req) => {
  await requireAdminPin(req);
  const body = PatchBody.parse(await req.json());
  await db.setting.upsert({
    where: { key: "locale" },
    update: { value: body.locale },
    create: { key: "locale", value: body.locale },
  });
  await syncCookie(body.locale);
  return ok({ ok: true, locale: body.locale });
});
