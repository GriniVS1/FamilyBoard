"use client";

import { useEffect, useState } from "react";

/**
 * Re-renders on every minute boundary so phase-dependent UI (who is "next")
 * flips at 11:00 sharp instead of up to a minute late. Null until mounted so
 * the server render and the first client render agree.
 */
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const schedule = () => {
      const current = new Date();
      setNow(current);
      const untilNextMinute = 60_000 - (current.getSeconds() * 1000 + current.getMilliseconds());
      timer = window.setTimeout(schedule, untilNextMinute + 50);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  return now;
}
