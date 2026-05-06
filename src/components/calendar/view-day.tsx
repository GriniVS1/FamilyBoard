"use client";

import { format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { hoursInRange, isToday } from "./date-utils";
import { EventBlock } from "./event-block";
import { EventPill } from "./event-pill";
import { layoutDayEvents, slotHeightPx } from "./layout-utils";
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
  const hours = hoursInRange();
  const slotPx = slotHeightPx();
  const gridHeight = hours.length * slotPx;

  const dayEvents = events.filter((e) => {
    const s = new Date(e.startsAt);
    const en = new Date(e.endsAt);
    return isSameDay(s, anchor) || (s < anchor && en > anchor);
  });
  const layout = layoutDayEvents(dayEvents, anchor);

  return (
    <div className="rounded-3xl border border-border bg-surface overflow-hidden">
      <div className="grid grid-cols-[64px_1fr] border-b border-border bg-bg/40">
        <div />
        <div
          className={cn(
            "px-3 py-3 border-l border-border",
            isToday(anchor) && "bg-accent-sky/10",
          )}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {format(anchor, "EEEE")}
          </div>
          <div
            className={cn(
              "mt-1 inline-flex size-8 items-center justify-center rounded-full tabular text-sm font-medium",
              isToday(anchor) ? "bg-ink text-bg" : "text-ink",
            )}
          >
            {format(anchor, "d")}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[64px_1fr] border-b border-border bg-bg/20">
        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted text-right">
          All day
        </div>
        <div className="border-l border-border min-h-[32px] py-1 px-1 flex flex-col gap-0.5">
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

      <div className="overflow-x-auto">
        <div
          className="grid grid-cols-[64px_1fr] relative"
          style={{ height: `${gridHeight}px` }}
        >
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
          <div
            className={cn(
              "relative border-l border-border",
              isToday(anchor) && "bg-accent-sky/5",
            )}
          >
            {hours.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => onSelectSlot(anchor, h)}
                className="absolute left-0 right-0 border-t border-border hover:bg-bg/30 transition-colors"
                style={{ top: `${(h - hours[0]!) * slotPx}px`, height: `${slotPx}px` }}
                aria-label={`Create event at ${String(h).padStart(2, "0")}:00`}
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
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
