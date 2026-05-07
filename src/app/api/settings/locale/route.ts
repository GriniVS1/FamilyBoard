import { z } from "zod";
import { ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { getCurrentLocale } from "@/i18n/locale";
import { locales } from "@/i18n/config";

export const runtime = "nodejs";

export const GET = withErrorHandling(async () => {
  const locale = await getCurrentLocale();
  return ok({ locale });
});

const PatchBody = z.object({
  locale: z.enum(locales),
});

export const PATCH = withErrorHandling(async (req) => {
  const body = PatchBody.parse(await req.json());
  await db.setting.upsert({
    where: { key: "locale" },
    update: { value: body.locale },
    create: { key: "locale", value: body.locale },
  });
  return ok({ ok: true, locale: body.locale });
});
