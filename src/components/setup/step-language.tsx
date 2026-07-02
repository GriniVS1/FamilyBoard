"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { locales, localeLabels, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

// First setup step — shown before anything else so the user picks a language
// they understand. Intentionally language-neutral: just a globe, a multilingual
// prompt, and the four language names in their own language. Selecting writes the
// `locale` setting and reloads; next-intl then renders the rest of the wizard in
// that language, and the wizard skips this step (localeChosen is now true).
export function StepLanguage() {
  const [saving, setSaving] = useState<Locale | null>(null);

  async function choose(locale: Locale) {
    if (saving) return;
    setSaving(locale);
    try {
      await fetch("/api/settings/locale", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      window.location.reload();
    } catch {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-3xl bg-accent-lilac/30">
          <Languages className="size-8 text-ink" />
        </span>
        <p className="text-muted text-lg font-medium">
          Sprache · Language · Langue · Lingua
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {locales.map((loc) => (
          <button
            key={loc}
            type="button"
            onClick={() => choose(loc)}
            disabled={saving !== null}
            className={cn(
              "rounded-3xl border border-border bg-surface px-6 py-8 text-xl font-medium text-ink shadow-soft tap-target transition-transform hover:bg-bg active:scale-[0.98]",
              saving === loc && "opacity-60",
              saving !== null && saving !== loc && "opacity-40",
            )}
          >
            {localeLabels[loc]}
          </button>
        ))}
      </div>
    </div>
  );
}
