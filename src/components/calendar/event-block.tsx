"use client";

import { format } from "date-fns";
import { Repeat } from "lucide-react";
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
  /** narrow-lane rendering (week view): give the title every pixel */
  compact?: boolean;
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
  compact = false,
}: EventBlockProps) {
  const color = resolveColor(event, member);
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const widthPct = 100 / laneCount;
  const leftPct = laneIndex * widthPct;

  // Overlapping events share the column width, so every character counts:
  // wrap the title onto two lines when the block is tall enough, and in
  // compact (narrow-lane) mode drop the member-name row — the colored stripe
  // already encodes the member. Keeps a full-hour block (56px) readable at
  // half or third of a week column.
  const canWrapTitle = height >= 52;

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
      <div className="font-semibold text-xs text-ink flex items-start gap-1">
        <span className={canWrapTitle ? "line-clamp-2 break-words" : "truncate"}>
          {event.title}
        </span>
        {event.isRecurring && (
          <Repeat className="mt-0.5 size-3 shrink-0 text-muted" aria-hidden="true" />
        )}
      </div>
      <div className="tabular text-[10px] text-muted truncate">
        {format(start, "HH:mm")} – {format(end, "HH:mm")}
      </div>
      {member && !compact ? (
        <div className="text-[10px] text-muted truncate">{member.name}</div>
      ) : null}
    </button>
  );
}
