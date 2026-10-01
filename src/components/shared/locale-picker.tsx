"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { locales, localeLabels, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

async function patchLocale(locale: Locale, adminPin?: string): Promise<void> {
  await fetch("/api/settings/locale", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(adminPin ? { "X-Admin-Pin": adminPin } : {}),
    },
    body: JSON.stringify({ locale }),
  });
  window.location.reload();
}

export function LocalePicker({ className, adminPin }: { className?: string; adminPin?: string }) {
  const currentLocale = useLocale();
  const [saving, setSaving] = useState(false);

  async function handleChange(locale: Locale) {
    if (locale === currentLocale || saving) return;
    setSaving(true);
    try {
      await patchLocale(locale, adminPin);
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => handleChange(loc)}
          disabled={saving}
          aria-pressed={loc === currentLocale}
          className={cn(
            "kid-label min-h-12 rounded-full border-2 px-5 transition-colors focus-ring-kid",
            loc === currentLocale
              ? "border-ink bg-ink text-bg"
              : "border-border bg-surface text-ink",
            saving && "opacity-50",
          )}
        >
          {localeLabels[loc]}
        </button>
      ))}
    </div>
  );
}

export function LocaleSelect({ className }: { className?: string }) {
  const currentLocale = useLocale();
  const t = useTranslations("setup.welcome");
  const [saving, setSaving] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const locale = e.target.value as Locale;
    if (locale === currentLocale || saving) return;
    setSaving(true);
    try {
      await patchLocale(locale);
    } catch {
      setSaving(false);
    }
  }

  return (
    <select
      value={currentLocale}
      onChange={handleChange}
      disabled={saving}
      aria-label={t("language")}
      className={cn(
        "h-12 rounded-2xl border border-border bg-surface px-3 text-base text-ink tap-target",
        saving && "opacity-50",
        className,
      )}
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {localeLabels[loc]}
        </option>
      ))}
    </select>
  );
}
