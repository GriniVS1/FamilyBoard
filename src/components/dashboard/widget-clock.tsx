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
    <GlassCard className={cn("p-8 flex flex-col justify-between", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {t("now")}
      </span>
      <div className="flex flex-1 flex-col items-start justify-center py-4">
        <span
          className="font-display text-7xl xl:text-8xl tabular leading-none tracking-tight text-ink"
          suppressHydrationWarning
        >
          {now ? formatTime(now) : "--:--"}
        </span>
        <span className="mt-3 text-base text-muted tabular" suppressHydrationWarning>
          {dateLabel}
        </span>
      </div>
    </GlassCard>
  );
}
