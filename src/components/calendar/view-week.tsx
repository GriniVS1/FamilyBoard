"use client";

import { format, isSameDay } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { hourAt, hoursInRange, isToday, weekDays } from "./date-utils";
import { EventBlock } from "./event-block";
import { EventPill } from "./event-pill";
import { COMPACT_LANE_PX, layoutDayEvents, maxLanesFor, slotHeightPx } from "./layout-utils";
import { NowGutterLabel, NowLine } from "./now-line";
import { useElementWidth } from "./use-element-width";
import type { CalendarEvent, CalendarMember } from "./types";

type ViewWeekProps = {
  anchor: Date;
  events: CalendarEvent[];
  membersById: Map<string, CalendarMember>;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectSlot: (day: Date, hour: number) => void;
  /** Opens the day view at the given hour; used by the "+N" block. */
  onOpenDay: (day: Date, hour: number) => void;
};

export function ViewWeek({
  anchor,
  events,
  membersById,
  onSelectEvent,
  onSelectSlot,
  onOpenDay,
}: ViewWeekProps) {
  const locale = useLocale();
  const t = useTranslations("calendar");
  const weekdayShortFmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const monthShortFmt = new Intl.DateTimeFormat(locale, { month: "short" });
  const days = weekDays(anchor);
  const nowMs = Date.now();
  const [gridRef, gridWidth] = useElementWidth<HTMLDivElement>();
  const columnWidth = gridWidth > 0 ? (gridWidth - 64) / 7 : 0;
  const hours = hoursInRange();
  const slotPx = slotHeightPx();
  const gridHeight = hours.length * slotPx;

  const dayLayouts = days.map((day) => {
    const dayEvents = events.filter((e) => {
      const s = new Date(e.startsAt);
      const en = new Date(e.endsAt);
      return isSameDay(s, day) || (s < day && en > day);
    });
    return { day, layout: layoutDayEvents(dayEvents, day, maxLanesFor(columnWidth)) };
  });

  return (
    <div>
      <div data-calendar-head className="sticky top-0 z-30 bg-surface">
      {/* Day headers */}
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-border">
        <div className="flex items-end justify-end px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          {monthShortFmt.format(anchor)}
        </div>
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "border-l border-border px-2 py-1.5 text-center",
              isToday(day) && "bg-accent-sky/10",
            )}
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">
              {weekdayShortFmt.format(day)}
            </div>
            <div
              className={cn(
                "mx-auto mt-1 inline-flex size-9 items-center justify-center rounded-full tabular text-base font-semibold",
                isToday(day) ? "bg-ink text-bg" : "text-ink",
              )}
            >
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* All-day row */}
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-border">
        <div className="px-1 py-1 text-right text-xs text-muted">
          {t("allDay")}
        </div>
        {dayLayouts.map(({ day, layout }) => (
          <div
            key={day.toISOString()}
            className="flex min-h-[32px] flex-col gap-1 border-l border-border px-1 py-1"
          >
            {layout.allDay.map((event) => (
              <EventPill
                key={event.id}
                narrow
                event={event}
                member={membersById.get(event.memberId)}
                onSelect={onSelectEvent}
              />
            ))}
          </div>
        ))}
      </div>
      </div>

      {/* Timed grid */}
      <div>
        <div
          className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] relative"
          ref={gridRef}
          data-timed-grid
          style={{ height: `${gridHeight}px` }}
        >
          {/* Hour labels column */}
          <div className="relative">
            {hours.map((h) => (
              <div
                key={h}
                className={cn(
                  "absolute right-2 text-xs uppercase tracking-wider text-muted tabular",
                  h === hours[0] ? "translate-y-1" : "-translate-y-1/2",
                )}
                style={{ top: `${(h - hours[0]!) * slotPx}px` }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
            <NowGutterLabel />
          </div>

          {/* 7 day columns */}
          {dayLayouts.map(({ day, layout }) => (
            <div
              key={day.toISOString()}
              className={cn(
                "relative border-l border-border",
                isToday(day) && "bg-accent-sky/5",
              )}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  onSelectSlot(day, hourAt(e.nativeEvent.offsetY, slotPx));
                }
              }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  aria-hidden
                  className="pointer-events-none absolute left-0 right-0 border-t border-border"
                  style={{ top: `${(h - hours[0]!) * slotPx}px` }}
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
                  compact={columnWidth > 0 && columnWidth / p.laneCount < COMPACT_LANE_PX}
                  past={new Date(p.event.endsAt).getTime() <= nowMs}
                  hidden={p.hidden}
                  onSelectHidden={(list) => onOpenDay(day, new Date(list[0]!.startsAt).getHours())}
                />
              ))}
              {isToday(day) && <NowLine />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
