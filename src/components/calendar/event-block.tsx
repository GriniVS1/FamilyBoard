"use client";

import { format } from "date-fns";
import { Repeat } from "lucide-react";
import { useTranslations } from "next-intl";
import { toneOf } from "@/components/kids/tone";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn } from "@/lib/utils";
import { resolveEventColor } from "./event-color";
import { EventGlyph } from "./event-glyph";
import type { CalendarEvent, CalendarMember } from "./types";

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
  /** narrow-lane rendering (overlapping events): picture and person only, no title */
  compact?: boolean;
  /** Ended events are muted, not hidden. */
  past?: boolean;
  /** Turns the block into a "+N" stand-in for events that found no lane. */
  hidden?: CalendarEvent[];
  onSelectHidden?: (events: CalendarEvent[]) => void;
};

export function EventBlock({
  event,
  member,
  onSelect,
  top,
  height,
  laneIndex = 0,
  laneCount = 1,
  compact = false,
  past = false,
  hidden,
  onSelectHidden,
}: EventBlockProps) {
  const t = useTranslations("calendar");
  const color = resolveEventColor(event, member);
  const tone = toneOf(color);
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const widthPct = 100 / laneCount;
  const leftPct = laneIndex * widthPct;
  const timeLabel = `${format(start, "HH:mm")}–${format(end, "HH:mm")}`;

  const position = {
    top: `${top}px`,
    height: `${Math.max(height, 48)}px`,
    // 9 px between neighbours (4.5 px per side): fractional column widths round
    // to 8 px on screen at worst, never 7.
    left: `calc(${leftPct}% + 4.5px)`,
    width: `calc(${widthPct}% - 9px)`,
  };

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => onSelectHidden?.(hidden)}
        aria-label={t("moreEvents", { count: hidden.length })}
        className={cn(
          "absolute z-10 flex min-h-[48px] items-center justify-center rounded-xl border-l-4 border-ink bg-ink/10",
          "font-display text-lg font-bold leading-none text-ink shadow-soft focus-ring-kid-inset",
        )}
        style={position}
      >
        +{hidden.length}
      </button>
    );
  }

  // The stripe colour alone must not say who an event belongs to: every block
  // carries the person's avatar.
  const avatar = member ? (
    <MemberAvatar
      name={member.name}
      color={member.color}
      emoji={member.emoji}
      className="size-6 shrink-0 border-0"
    />
  ) : null;

  const title = (
    <div
      className={cn(
        "flex items-start gap-1 text-sm font-semibold leading-tight",
        past ? "text-muted" : "text-ink",
      )}
    >
      <span className="line-clamp-2 break-words hyphens-auto">
        {event.title}
      </span>
      {event.isRecurring && (
        <Repeat className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
      )}
    </div>
  );

  return (
    <button
      type="button"
      onClick={() => onSelect?.(event)}
      aria-label={`${event.title}, ${timeLabel}`}
      title={event.title}
      className={cn(
        "absolute z-10 min-h-[48px] overflow-hidden rounded-xl border-l-4 py-1.5 text-left",
        compact ? "px-1" : "px-2",
        "shadow-soft transition-shadow focus-ring-kid-inset",
        tone.tint,
        tone.border,
      )}
      style={position}
    >
      {compact ? (
        <div className="flex flex-col items-center gap-1">
          <EventGlyph title={event.title} color={color} date={start} size={20} />
          {avatar}
        </div>
      ) : (
        <div className="flex gap-1.5">
          <div className="flex shrink-0 flex-col items-center gap-1">
            <EventGlyph title={event.title} color={color} date={start} size={24} />
            {avatar}
          </div>
          <div className="min-w-0">
            {title}
            <div className="tabular truncate text-xs text-muted">{timeLabel}</div>
          </div>
        </div>
      )}
    </button>
  );
}
