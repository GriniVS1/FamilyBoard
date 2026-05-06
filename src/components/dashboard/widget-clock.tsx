"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatTime(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDate(d: Date) {
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

type WidgetClockProps = {
  className?: string;
};

export function WidgetClock({ className }: WidgetClockProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <GlassCard className={cn("p-8 flex flex-col justify-between", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        Now
      </span>
      <div className="flex flex-1 flex-col items-start justify-center py-4">
        <span
          className="font-display text-7xl xl:text-8xl tabular leading-none tracking-tight text-ink"
          suppressHydrationWarning
        >
          {now ? formatTime(now) : "--:--"}
        </span>
        <span className="mt-3 text-base text-muted tabular" suppressHydrationWarning>
          {now ? formatDate(now) : ""}
        </span>
      </div>
    </GlassCard>
  );
}
