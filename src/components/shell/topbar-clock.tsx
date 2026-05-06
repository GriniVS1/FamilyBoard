"use client";

import { useEffect, useState } from "react";

function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function TopbarClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className="tabular text-sm font-medium text-ink"
      aria-label="Current time"
      suppressHydrationWarning
    >
      {now ? formatTime(now) : "--:--"}
    </span>
  );
}
