import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { CalendarView } from "./types";

const WEEK_OPTIONS = { weekStartsOn: 1 as const };

export function rangeForView(view: CalendarView, anchor: Date): { from: Date; to: Date } {
  if (view === "day") {
    return { from: startOfDay(anchor), to: endOfDay(anchor) };
  }
  if (view === "week") {
    return {
      from: startOfWeek(anchor, WEEK_OPTIONS),
      to: endOfWeek(anchor, WEEK_OPTIONS),
    };
  }
  // month — always show 6-row grid (start of week containing 1st, +42 days)
  const firstDay = startOfMonth(anchor);
  const gridStart = startOfWeek(firstDay, WEEK_OPTIONS);
  return {
    from: gridStart,
    to: endOfDay(addDays(gridStart, 41)),
  };
}

export function viewLabel(view: CalendarView, anchor: Date, locale: string = "en"): string {
  if (view === "day") {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(anchor);
  }
  if (view === "week") {
    const start = startOfWeek(anchor, WEEK_OPTIONS);
    const end = endOfWeek(anchor, WEEK_OPTIONS);
    if (isSameMonth(start, end)) {
      const startFmt = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" });
      const endFmt = new Intl.DateTimeFormat(locale, { day: "numeric", year: "numeric" });
      return `${startFmt.format(start)} – ${endFmt.format(end)}`;
    }
    const fmt = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  }
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(anchor);
}

export function shiftDate(view: CalendarView, anchor: Date, dir: -1 | 1): Date {
  if (view === "day") return addDays(anchor, dir);
  if (view === "week") return addWeeks(anchor, dir);
  return addMonths(anchor, dir);
}

export function buildMonthGrid(anchor: Date): Date[] {
  const firstDay = startOfMonth(anchor);
  const gridStart = startOfWeek(firstDay, WEEK_OPTIONS);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, WEEK_OPTIONS);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const HOUR_START = 6;
export const HOUR_END = 23;

export function hoursInRange(): number[] {
  return Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

export {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
};
