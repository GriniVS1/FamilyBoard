import type { Event, EventOverride } from "@prisma/client";
import ICAL from "ical.js";

export type EventWithOverrides = Event & { overrides: EventOverride[] };

export type ExpandedEvent = Event & {
  seriesId: string | null;
  isRecurring: boolean;
};

const SAFETY_LIMIT = 5000;

/**
 * Expands recurring events (those with an rrule) into individual occurrences
 * within [from, to), and passes non-recurring events through unchanged.
 *
 * Overrides are applied per-occurrence using the ORIGINAL recurrenceId
 * (the occurrence's natural ISO start) as the stable lookup key — even when
 * the override shifts startsAt to a different time.
 *
 * Fast-forward: iteration starts from max(event.startsAt, from - duration)
 * so long-running series don't burn the safety counter before reaching the
 * visible window.
 */
export function expandEventsInRange(
  events: EventWithOverrides[],
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

    // Build a fast O(1) lookup for this master's overrides keyed by recurrenceId.
    const overrideMap = new Map<string, EventOverride>();
    for (const ov of event.overrides) {
      overrideMap.set(ov.recurrenceId, ov);
    }

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

      const naturalStart = next.toJSDate();

      // Skip occurrences before our fast-forward window.
      if (naturalStart < windowStart) {
        next = iter.next();
        continue;
      }

      // Stop once past the query window.
      if (naturalStart >= to) break;

      // The recurrenceId is always the NATURAL (unoverridden) ISO start —
      // this is the stable round-trip key used in synthetic IDs and override lookup.
      const recurrenceId = naturalStart.toISOString();
      const override = overrideMap.get(recurrenceId);

      if (override?.cancelled) {
        next = iter.next();
        continue;
      }

      const effectiveStart = override?.startsAt ?? naturalStart;
      const effectiveEnd =
        override?.endsAt ?? new Date(effectiveStart.getTime() + durationMs);

      result.push({
        ...event,
        id: `${event.id}__${recurrenceId}`,
        seriesId: event.id,
        isRecurring: true,
        title: override?.title ?? event.title,
        description: override?.description ?? event.description,
        location: override?.location ?? event.location,
        startsAt: effectiveStart,
        endsAt: effectiveEnd,
        allDay: override?.allDay ?? event.allDay,
        color: override?.color ?? event.color,
      });

      next = iter.next();
    }
  }

  return result;
}
