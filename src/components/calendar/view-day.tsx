"use client";

import { format, isSameDay } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { hourAt, hoursInRange, isToday } from "./date-utils";
import { EventBlock } from "./event-block";
import { EventPill } from "./event-pill";
import { COMPACT_LANE_PX, layoutDayEvents, maxLanesFor, slotHeightPx } from "./layout-utils";
import { NowGutterLabel, NowLine } from "./now-line";
import { useElementWidth } from "./use-element-width";
import type { CalendarEvent, CalendarMember } from "./types";

type ViewDayProps = {
  anchor: Date;
  events: CalendarEvent[];
  membersById: Map<string, CalendarMember>;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectSlot: (day: Date, hour: number) => void;
};

export function ViewDay({
  anchor,
  events,
  membersById,
  onSelectEvent,
  onSelectSlot,
}: ViewDayProps) {
  const locale = useLocale();
  const t = useTranslations("calendar");
  const weekdayLong = `${new Intl.DateTimeFormat(locale, { weekday: "long" }).format(anchor)} · ${new Intl.DateTimeFormat(locale, { month: "long" }).format(anchor)}`;
  const nowMs = Date.now();
  const [gridRef, gridWidth] = useElementWidth<HTMLDivElement>();
  const columnWidth = gridWidth > 0 ? gridWidth - 64 : 0;
  const hours = hoursInRange();
  const slotPx = slotHeightPx();
  const gridHeight = hours.length * slotPx;

  const dayEvents = events.filter((e) => {
    const s = new Date(e.startsAt);
    const en = new Date(e.endsAt);
    return isSameDay(s, anchor) || (s < anchor && en > anchor);
  });
  const layout = layoutDayEvents(dayEvents, anchor, maxLanesFor(columnWidth));

  return (
    <div>
      <div data-calendar-head className="sticky top-0 z-30 bg-surface">
      <div className="grid grid-cols-[64px_1fr] border-b border-border">
        <div />
        <div
          className={cn(
            "flex items-center gap-3 border-l border-border px-3 py-1.5",
            isToday(anchor) && "bg-accent-sky/10",
          )}
        >
          <div
            className={cn(
              "inline-flex size-9 items-center justify-center rounded-full tabular text-base font-semibold",
              isToday(anchor) ? "bg-ink text-bg" : "text-ink",
            )}
          >
            {format(anchor, "d")}
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            {weekdayLong}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[64px_1fr] border-b border-border">
        <div className="px-1 py-1 text-right text-xs text-muted">
          {t("allDay")}
        </div>
        <div className="flex min-h-[32px] flex-col gap-1 border-l border-border px-1 py-1">
          {layout.allDay.map((event) => (
            <EventPill
              key={event.id}
              event={event}
              member={membersById.get(event.memberId)}
              onSelect={onSelectEvent}
            />
          ))}
        </div>
      </div>
      </div>

      <div>
        <div
          className="grid grid-cols-[64px_1fr] relative"
          ref={gridRef}
          data-timed-grid
          style={{ height: `${gridHeight}px` }}
        >
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
          <div
            className={cn(
              "relative border-l border-border",
              isToday(anchor) && "bg-accent-sky/5",
            )}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                onSelectSlot(anchor, hourAt(e.nativeEvent.offsetY, slotPx));
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
                onSelectHidden={(list) => onSelectEvent(list[0]!)}
              />
            ))}
            {isToday(anchor) && <NowLine />}
          </div>
        </div>
      </div>
    </div>
  );
}
