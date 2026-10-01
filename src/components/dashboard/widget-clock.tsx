"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";

function formatTime(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

type WidgetClockProps = {
  className?: string;
};

export function WidgetClock({ className }: WidgetClockProps) {
  const locale = useLocale();
  const t = useTranslations("dashboard.widgets.clock");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateLabel = now
    ? new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(now)
    : "";

  return (
    <GlassCard className={cn("flex flex-col justify-center gap-1 px-6 py-5", className)}>
      <span className="sr-only">{t("now")}</span>
      <span
        className="font-display text-6xl tabular leading-none tracking-tight text-ink xl:text-7xl"
        suppressHydrationWarning
      >
        {now ? formatTime(now) : "--:--"}
      </span>
      <span className="kid-body text-muted tabular" suppressHydrationWarning>
        {dateLabel}
      </span>
    </GlassCard>
  );
}
