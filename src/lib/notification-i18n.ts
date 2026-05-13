import "server-only";
import { createTranslator } from "use-intl/core";
import { getCurrentLocale } from "@/i18n/locale";

export async function getNotificationTranslator() {
  const locale = await getCurrentLocale();
  const messages = (await import(`../messages/${locale}.json`)).default as Record<string, unknown>;
  const t = createTranslator({ locale, messages });
  return { t, locale };
}
