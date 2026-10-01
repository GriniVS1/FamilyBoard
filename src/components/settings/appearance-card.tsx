"use client";

import { Check, Moon, Sun, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark";

const CHOICES: { value: ThemeChoice; icon: LucideIcon; labelKey: "themeLight" | "themeDark" }[] = [
  { value: "light", icon: Sun, labelKey: "themeLight" },
  { value: "dark", icon: Moon, labelKey: "themeDark" },
];

export function AppearanceCard() {
  const t = useTranslations("settings");
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = mounted ? resolvedTheme : null;

  return (
    <GlassCard className="flex flex-col gap-4 p-6">
      <div className="space-y-1">
        <h2 className="font-display text-xl text-ink">{t("appearance")}</h2>
        <p className="text-sm text-muted">{t("appearanceDescription")}</p>
      </div>
      <div role="radiogroup" aria-label={t("appearance")} className="grid grid-cols-2 gap-3">
        {CHOICES.map(({ value, icon: Icon, labelKey }) => {
          const selected = current === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(value)}
              className={cn(
                "relative flex h-20 items-center justify-center gap-3 rounded-3xl border-2 text-ink",
                "kid-title transition-colors duration-kid focus-ring-kid active:scale-[0.97]",
                selected
                  ? "border-accent-sky bg-accent-sky-tint shadow-pop"
                  : "border-border bg-surface",
              )}
            >
              <Icon className="size-7" strokeWidth={2.25} aria-hidden />
              {t(labelKey)}
              {selected && (
                <span
                  aria-hidden
                  className="absolute right-3 top-3 inline-flex size-6 items-center justify-center rounded-full bg-accent-sky text-on-accent"
                >
                  <Check className="size-4" strokeWidth={3.5} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}
