import { getRequestConfig } from "next-intl/server";
import { getCurrentLocale } from "./locale";

export default getRequestConfig(async () => {
  const locale = await getCurrentLocale();
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
