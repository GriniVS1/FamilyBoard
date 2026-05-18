import type { Event } from "@prisma/client";
import ICAL from "ical.js";

export type ExpandedEvent = Event & {
  seriesId: string | null;
  isRecurring: boolean;
};

const SAFETY_LIMIT = 5000;

/**
 * Expands recurring events (those with an rrule) into individual occurrences
 * within [from, to), and passes non-recurring events through unchanged.
 *
 * Fast-forward: iteration starts from max(event.startsAt, from - duration)
 * so long-running series don't burn the safety counter before reaching the
 * visible window.
 */
export function expandEventsInRange(
  events: Event[],
  from: Date,
  to: Date,
): ExpandedEvent[] {
  const result: ExpandedEvent[] = [];

  for (const event of events) {
    if (!event.rrule) {
      result.push({ ...event, seriesId: null, isRecurring: false });
      continue;
    }

    const durationMs =
      event.endsAt.getTime() - event.startsAt.getTime();

    // Fast-forward the window start back by one duration so occurrences
    // that began before `from` but end after it are included.
    const windowStart = new Date(
      Math.max(event.startsAt.getTime(), from.getTime() - durationMs),
    );

    const recur = ICAL.Recur.fromString(event.rrule);
    const dtstart = ICAL.Time.fromJSDate(event.startsAt, true);
    const iter = recur.iterator(dtstart);

    let safety = 0;
    let next = iter.next();

    while (next && !iter.completed) {
      if (safety++ >= SAFETY_LIMIT) break;

      const occurrenceStart = next.toJSDate();

      // Skip occurrences before our fast-forward window.
      if (occurrenceStart < windowStart) {
        next = iter.next();
        continue;
      }

      // Stop once past the query window.
      if (occurrenceStart >= to) break;

      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
      const isoStart = occurrenceStart.toISOString();

      result.push({
        ...event,
        id: `${event.id}__${isoStart}`,
        seriesId: event.id,
        isRecurring: true,
        startsAt: occurrenceStart,
        endsAt: occurrenceEnd,
      });

      next = iter.next();
    }
  }

  return result;
}
