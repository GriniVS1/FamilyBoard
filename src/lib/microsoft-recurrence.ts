import "server-only";

import ICAL from "ical.js";
import { AppError } from "./api";

export type GraphRecurrencePattern = {
  type: "daily" | "weekly" | "absoluteMonthly" | "absoluteYearly";
  interval: number;
  daysOfWeek?: string[];
  dayOfMonth?: number;
  month?: number;
};

export type GraphRecurrenceRange =
  | { type: "noEnd"; startDate: string }
  | { type: "endDate"; startDate: string; endDate: string }
  | { type: "numbered"; startDate: string; numberOfOccurrences: number };

export type GraphRecurrence = {
  pattern: GraphRecurrencePattern;
  range: GraphRecurrenceRange;
};

const ICAL_DAY_TO_GRAPH: Record<string, string> = {
  MO: "monday",
  TU: "tuesday",
  WE: "wednesday",
  TH: "thursday",
  FR: "friday",
  SA: "saturday",
  SU: "sunday",
};

// JS Date.getUTCDay(): 0=Sunday,1=Monday,...,6=Saturday → Graph day name
const UTC_DAY_INDEX_TO_GRAPH = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function iCalDayToGraph(icalDay: string): string {
  // BYDAY values may carry ordinal prefix (e.g. "+1MO", "-2FR"); strip it.
  const key = icalDay.replace(/^[+-]?\d/, "").toUpperCase();
  const mapped = ICAL_DAY_TO_GRAPH[key];
  if (!mapped) {
    throw new AppError(
      `Unknown BYDAY value "${icalDay}"`,
      "MICROSOFT_RECURRENCE_UNSUPPORTED",
      400,
    );
  }
  return mapped;
}

function buildRange(
  recur: ICAL.Recur,
  startDate: string,
): GraphRecurrenceRange {
  if (recur.count !== null && recur.count > 0) {
    return { type: "numbered", startDate, numberOfOccurrences: recur.count };
  }
  if (recur.until !== null) {
    // Prefer direct year/month/day accessors — avoids string-parsing ambiguity
    // between date-only and datetime UNTIL forms.
    const u = recur.until;
    const y = u.year;
    const m = String(u.month).padStart(2, "0");
    const d = String(u.day).padStart(2, "0");
    return { type: "endDate", startDate, endDate: `${y}-${m}-${d}` };
  }
  return { type: "noEnd", startDate };
}

export function rruleToGraphRecurrence(
  rrule: string,
  startsAt: Date,
): GraphRecurrence {
  const recur = ICAL.Recur.fromString(rrule);

  const interval = recur.interval > 0 ? recur.interval : 1;
  const startDate = startsAt.toISOString().slice(0, 10);
  const range = buildRange(recur, startDate);

  const freq = recur.freq?.toUpperCase();

  switch (freq) {
    case "DAILY": {
      return {
        pattern: { type: "daily", interval },
        range,
      };
    }

    case "WEEKLY": {
      const byday = recur.parts?.BYDAY;
      let daysOfWeek: string[];
      if (byday && byday.length > 0) {
        daysOfWeek = byday.map(iCalDayToGraph);
      } else {
        // Default to the weekday of startsAt.
        daysOfWeek = [UTC_DAY_INDEX_TO_GRAPH[startsAt.getUTCDay()]];
      }
      return {
        pattern: { type: "weekly", interval, daysOfWeek },
        range,
      };
    }

    case "MONTHLY": {
      const bymonthday = recur.parts?.BYMONTHDAY;
      const dayOfMonth =
        bymonthday && bymonthday.length > 0
          ? bymonthday[0]
          : startsAt.getUTCDate();
      return {
        pattern: { type: "absoluteMonthly", interval, dayOfMonth },
        range,
      };
    }

    case "YEARLY": {
      const bymonthday = recur.parts?.BYMONTHDAY;
      const bymonth = recur.parts?.BYMONTH;
      const dayOfMonth =
        bymonthday && bymonthday.length > 0
          ? bymonthday[0]
          : startsAt.getUTCDate();
      // BYMONTH in ical.js is 1-based already.
      const month =
        bymonth && bymonth.length > 0
          ? bymonth[0]
          : startsAt.getUTCMonth() + 1;
      return {
        pattern: { type: "absoluteYearly", interval, dayOfMonth, month },
        range,
      };
    }

    default:
      throw new AppError(
        `Unsupported recurrence frequency for Microsoft: ${freq}`,
        "MICROSOFT_RECURRENCE_UNSUPPORTED",
        400,
      );
  }
}
