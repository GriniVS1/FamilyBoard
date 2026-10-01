"use client";

import { format, isSameMonth, startOfDay, addDays, startOfWeek } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
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
  const locale = useLocale();
  const t = useTranslations("calendar");
  const days = buildMonthGrid(anchor);
  const weekdayShortFmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const fullDateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    weekdayShortFmt.format(addDays(weekStart, i)),
  );

  return (
    <div>
      <div
        data-calendar-head
        className="sticky top-0 z-30 grid grid-cols-7 border-b border-border bg-surface"
      >
        {weekdayLabels.map((d, i) => (
          <div
            key={i}
            className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted"
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
                className="absolute inset-0 rounded-none transition-colors hover:bg-ink/5 focus-ring-kid-inset"
                aria-label={t("createEventOnDay", { day: fullDateFmt.format(day) })}
              />
              <div className="relative flex items-center justify-end pointer-events-none">
                <span
                  className={cn(
                    "tabular inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold",
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
                    dense
                    event={event}
                    member={membersById.get(event.memberId)}
                    onSelect={(e) => {
                      onSelectEvent(e);
                    }}
                  />
                ))}
                {overflow > 0 && (
                  <span className="px-1 text-xs text-muted">
                    {t("moreEvents", { count: overflow })}
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
