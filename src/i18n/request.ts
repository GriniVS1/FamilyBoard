import { getRequestConfig } from "next-intl/server";
import { resolveLocaleForRequest } from "./locale";

export default getRequestConfig(async () => {
  const locale = await resolveLocaleForRequest();
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
