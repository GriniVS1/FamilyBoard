"use client";

import { format } from "date-fns";
import { useNow } from "@/components/shell/use-now";
import { HOUR_END, HOUR_START } from "./date-utils";
import { pixelsPerMinute } from "./layout-utils";

function offsetPx(now: Date): number | null {
  const minutes = now.getHours() * 60 + now.getMinutes() - HOUR_START * 60;
  const top = minutes * pixelsPerMinute();
  const max = (HOUR_END - HOUR_START + 1) * 60 * pixelsPerMinute();
  return top >= 0 && top <= max ? top : null;
}

/** Line across today's column; the ink colour keeps red free for errors. */
export function NowLine() {
  const now = useNow(60_000);
  const top = now ? offsetPx(now) : null;
  if (top === null) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-ink"
      style={{ top }}
    >
      <span className="absolute -left-1.5 -top-[5px] size-3 rounded-full bg-ink" />
    </div>
  );
}

/** Time chip in the hour gutter, aligned with {@link NowLine}. */
export function NowGutterLabel() {
  const now = useNow(60_000);
  const top = now ? offsetPx(now) : null;
  if (!now || top === null) return null;
  return (
    <span
      aria-hidden
      className="kid-label tabular pointer-events-none absolute right-1 z-20 -translate-y-1/2 rounded-full bg-ink px-2 text-bg"
      style={{ top }}
    >
      {format(now, "HH:mm")}
    </span>
  );
}
