"use client";

import { format, isSameMonth, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { buildMonthGrid, isToday } from "./date-utils";
import { EventPill } from "./event-pill";
import type { CalendarEvent, CalendarMember } from "./types";

type ViewMonthProps = {
  anchor: Date;
  events: CalendarEvent[];
  membersById: Map<string, CalendarMember>;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectDay: (day: Date) => void;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_VISIBLE = 3;

function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const start = startOfDay(day).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return events
    .filter((e) => {
      const s = new Date(e.startsAt).getTime();
      const eEnd = new Date(e.endsAt).getTime();
      return s < end && eEnd > start;
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export function ViewMonth({
  anchor,
  events,
  membersById,
  onSelectEvent,
  onSelectDay,
}: ViewMonthProps) {
  const days = buildMonthGrid(anchor);

  return (
    <div className="rounded-3xl border border-border bg-surface overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-bg/40">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted text-center"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((day, idx) => {
          const dayEvents = eventsOnDay(events, day);
          const visible = dayEvents.slice(0, MAX_VISIBLE);
          const overflow = dayEvents.length - visible.length;
          const inMonth = isSameMonth(day, anchor);
          const today = isToday(day);

          return (
            <div
              key={idx}
              className={cn(
                "relative flex flex-col gap-1 px-1.5 py-1.5 min-h-[96px] sm:min-h-[110px]",
                "border-r border-b border-border last:border-r-0",
                "transition-colors",
                !inMonth && "opacity-60 bg-bg/20",
              )}
            >
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                className="absolute inset-0 hover:bg-bg/30 transition-colors rounded-none"
                aria-label={`Create event on ${format(day, "PPPP")}`}
              />
              <div className="relative flex items-center justify-end pointer-events-none">
                <span
                  className={cn(
                    "tabular text-xs font-medium inline-flex size-7 items-center justify-center rounded-full",
                    today ? "bg-ink text-bg" : "text-ink",
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>
              <div className="relative flex flex-col gap-0.5 overflow-hidden">
                {visible.map((event) => (
                  <EventPill
                    key={event.id}
                    event={event}
                    member={membersById.get(event.memberId)}
                    onSelect={(e) => {
                      onSelectEvent(e);
                    }}
                  />
                ))}
                {overflow > 0 && (
                  <span className="text-[10px] text-muted px-1">
                    +{overflow} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
