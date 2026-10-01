"use client";

import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Repeat } from "lucide-react";
import { toneOf } from "@/components/kids/tone";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn } from "@/lib/utils";
import { resolveEventColor } from "./event-color";
import { EventGlyph } from "./event-glyph";
import type { CalendarEvent, CalendarMember } from "./types";

type EventPillProps = {
  event: CalendarEvent;
  member?: CalendarMember;
  onSelect?: (event: CalendarEvent) => void;
  className?: string;
  /** Month cells are too small for 48 px pills; everywhere else the pill is a full touch target. */
  dense?: boolean;
  /** Week columns leave no room for picture, title and avatar together; the avatar is dropped. */
  narrow?: boolean;
};

export function EventPill({
  event,
  member,
  onSelect,
  className,
  dense = false,
  narrow = false,
}: EventPillProps) {
  const t = useTranslations("calendar");
  const color = resolveEventColor(event, member);
  const tone = toneOf(color);
  const start = new Date(event.startsAt);
  const time = event.allDay ? t("allDay") : format(start, "HH:mm");

  return (
    <button
      type="button"
      onClick={() => onSelect?.(event)}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-lg border-l-4 px-1.5 text-left text-xs leading-tight",
        "transition-colors focus-ring-kid-inset",
        dense ? "min-h-7 py-0.5" : "min-h-12 py-1 text-sm",
        tone.tint,
        tone.border,
        className,
      )}
      aria-label={`${event.title} — ${time}`}
    >
      <EventGlyph title={event.title} color={color} date={start} size={dense ? 18 : 28} />
      {!event.allDay && <span className="tabular shrink-0 text-muted">{time}</span>}
      <span className={cn("min-w-0 flex-1 font-medium text-ink", dense ? "truncate" : "line-clamp-2 break-words hyphens-auto")}>{event.title}</span>
      {event.isRecurring && (
        <Repeat className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
      )}
      {!dense && !narrow && member && (
        <MemberAvatar
          name={member.name}
          color={member.color}
          emoji={member.emoji}
          className="size-6 shrink-0 border-0"
        />
      )}
    </button>
  );
}
