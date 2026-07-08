"use client";

import { format, isSameDay } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { hoursInRange, isToday, weekDays } from "./date-utils";
import { EventBlock } from "./event-block";
import { EventPill } from "./event-pill";
import { layoutDayEvents, slotHeightPx } from "./layout-utils";
import type { CalendarEvent, CalendarMember } from "./types";

type ViewWeekProps = {
  anchor: Date;
  events: CalendarEvent[];
  membersById: Map<string, CalendarMember>;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectSlot: (day: Date, hour: number) => void;
};

export function ViewWeek({
  anchor,
  events,
  membersById,
  onSelectEvent,
  onSelectSlot,
}: ViewWeekProps) {
  const locale = useLocale();
  const t = useTranslations("calendar");
  const weekdayShortFmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const fullDateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
  const days = weekDays(anchor);
  const hours = hoursInRange();
  const slotPx = slotHeightPx();
  const gridHeight = hours.length * slotPx;

  const dayLayouts = days.map((day) => {
    const dayEvents = events.filter((e) => {
      const s = new Date(e.startsAt);
      const en = new Date(e.endsAt);
      return isSameDay(s, day) || (s < day && en > day);
    });
    return { day, layout: layoutDayEvents(dayEvents, day) };
  });

  return (
    <div className="rounded-3xl border border-border bg-surface overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-border bg-bg/40">
        <div />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "px-2 py-3 text-center border-l border-border",
              isToday(day) && "bg-accent-sky/10",
            )}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {weekdayShortFmt.format(day)}
            </div>
            <div
              className={cn(
                "mt-1 mx-auto inline-flex size-8 items-center justify-center rounded-full tabular text-sm font-medium",
                isToday(day) ? "bg-ink text-bg" : "text-ink",
              )}
            >
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* All-day row */}
      <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-border bg-bg/20">
        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted text-right">
          {t("allDay")}
        </div>
        {dayLayouts.map(({ day, layout }) => (
          <div
            key={day.toISOString()}
            className="border-l border-border min-h-[32px] py-1 px-1 flex flex-col gap-0.5"
          >
            {layout.allDay.map((event) => (
              <EventPill
                key={event.id}
                event={event}
                member={membersById.get(event.memberId)}
                onSelect={onSelectEvent}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Timed grid */}
      <div className="overflow-x-auto">
        <div
          className="grid grid-cols-[64px_repeat(7,1fr)] relative"
          style={{ height: `${gridHeight}px` }}
        >
          {/* Hour labels column */}
          <div className="relative">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[10px] uppercase tracking-wider text-muted tabular"
                style={{ top: `${(h - hours[0]!) * slotPx}px` }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* 7 day columns */}
          {dayLayouts.map(({ day, layout }) => (
            <div
              key={day.toISOString()}
              className={cn(
                "relative border-l border-border",
                isToday(day) && "bg-accent-sky/5",
              )}
            >
              {/* hour rows */}
              {hours.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => onSelectSlot(day, h)}
                  className="absolute left-0 right-0 border-t border-border hover:bg-bg/30 transition-colors"
                  style={{ top: `${(h - hours[0]!) * slotPx}px`, height: `${slotPx}px` }}
                  aria-label={t("createEventAt", { time: `${String(h).padStart(2, "0")}:00` }) + " — " + fullDateFmt.format(day)}
                />
              ))}
              {/* events */}
              {layout.timed.map((p) => (
                <EventBlock
                  key={p.event.id}
                  event={p.event}
                  member={membersById.get(p.event.memberId)}
                  onSelect={onSelectEvent}
                  top={p.top}
                  height={p.height}
                  laneIndex={p.laneIndex}
                  laneCount={p.laneCount}
                  compact={p.laneCount > 1}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
