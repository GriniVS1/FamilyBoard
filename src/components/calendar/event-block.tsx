"use client";

import { format } from "date-fns";
import { cn, isMemberColor, type MemberColor } from "@/lib/utils";
import { COLOR_BORDER, COLOR_TINT, type CalendarEvent, type CalendarMember } from "./types";

type EventBlockProps = {
  event: CalendarEvent;
  member?: CalendarMember;
  onSelect?: (event: CalendarEvent) => void;
  /** top in pixels relative to grid origin */
  top: number;
  /** height in pixels */
  height: number;
  /** horizontal subdivision when overlapping */
  laneIndex?: number;
  laneCount?: number;
};

function resolveColor(event: CalendarEvent, member?: CalendarMember): MemberColor {
  const candidate = event.color ?? member?.color ?? "sand";
  return isMemberColor(candidate) ? candidate : "sand";
}

export function EventBlock({
  event,
  member,
  onSelect,
  top,
  height,
  laneIndex = 0,
  laneCount = 1,
}: EventBlockProps) {
  const color = resolveColor(event, member);
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const widthPct = 100 / laneCount;
  const leftPct = laneIndex * widthPct;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(event)}
      className={cn(
        "absolute rounded-xl px-2 py-1.5 border-l-4 text-left overflow-hidden",
        "shadow-soft hover:shadow-lift transition-shadow z-10",
        "min-h-[48px]",
        COLOR_TINT[color],
        COLOR_BORDER[color],
      )}
      style={{
        top: `${top}px`,
        height: `${Math.max(height, 28)}px`,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
      }}
    >
      <div className="font-semibold text-xs text-ink truncate">{event.title}</div>
      <div className="tabular text-[10px] text-muted truncate">
        {format(start, "HH:mm")} – {format(end, "HH:mm")}
      </div>
      {member ? (
        <div className="text-[10px] text-muted truncate">{member.name}</div>
      ) : null}
    </button>
  );
}
