export const locales = ["en", "de", "fr", "it"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export function isLocale(v: string): v is Locale {
  return (locales as readonly string[]).includes(v);
}
export const localeLabels: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
};
