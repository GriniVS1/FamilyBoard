"use client";

import { useTranslations } from "next-intl";
import { Repeat } from "lucide-react";
import { cn, isMemberColor, type MemberColor } from "@/lib/utils";
import { COLOR_BORDER, COLOR_TINT, type CalendarEvent, type CalendarMember } from "./types";

type EventPillProps = {
  event: CalendarEvent;
  member?: CalendarMember;
  onSelect?: (event: CalendarEvent) => void;
  className?: string;
};

function resolveColor(event: CalendarEvent, member?: CalendarMember): MemberColor {
  const candidate = event.color ?? member?.color ?? "sand";
  return isMemberColor(candidate) ? candidate : "sand";
}

export function EventPill({ event, member, onSelect, className }: EventPillProps) {
  const t = useTranslations("calendar");
  const color = resolveColor(event, member);
  const time = event.allDay
    ? t("allDay")
    : new Date(event.startsAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

  return (
    <button
      type="button"
      onClick={() => onSelect?.(event)}
      className={cn(
        "w-full text-left rounded-lg px-2 py-1 border-l-4",
        "text-[11px] leading-tight truncate transition-colors",
        "hover:brightness-105",
        COLOR_TINT[color],
        COLOR_BORDER[color],
        className,
      )}
      aria-label={`${event.title} — ${time}`}
    >
      <span className="font-medium text-ink truncate flex items-center gap-1">
        <span className="tabular text-muted mr-1">{!event.allDay ? time : ""}</span>
        <span className="truncate">{event.title}</span>
        {event.isRecurring && (
          <Repeat className="size-3 shrink-0 text-muted" aria-hidden="true" />
        )}
      </span>
    </button>
  );
}
