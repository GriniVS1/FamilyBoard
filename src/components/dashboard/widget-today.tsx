"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { endOfDay, format, startOfDay } from "date-fns";
import { useMemo } from "react";
import { EventGlyph } from "@/components/calendar/event-glyph";
import { resolveEventColor } from "@/components/calendar/event-color";
import type { CalendarEvent } from "@/components/calendar/types";
import { toneOf } from "@/components/kids/tone";
import { EmptyState, ErrorState, Skeleton } from "@/components/kids/state-views";
import { Picto, type PictoName } from "@/components/pictos";
import { GlassCard } from "@/components/shared/glass-card";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { useNow } from "@/components/shell/use-now";
import { phaseOf } from "@/lib/time-of-day";
import { cn } from "@/lib/utils";
import { WidgetHeader } from "./widget-header";

type MemberLite = {
  id: string;
  name: string;
  color: string;
  emoji?: string | null;
};

type WidgetTodayProps = {
  className?: string;
  members?: MemberLite[];
};

type Band = "MORNING" | "DAY" | "EVENING";

const BAND_ORDER: readonly Band[] = ["MORNING", "DAY", "EVENING"];

const BAND_PICTO: Record<Band, PictoName> = {
  MORNING: "tod-morning",
  DAY: "tod-day",
  EVENING: "tod-evening",
};

// Events between midnight and 05:00 read as "early morning", not a fourth band.
function bandOf(date: Date): Band {
  const phase = phaseOf(date);
  return phase === "NIGHT" ? "MORNING" : phase;
}

async function fetchTodayEvents(): Promise<CalendarEvent[]> {
  const now = new Date();
  const params = new URLSearchParams({
    from: startOfDay(now).toISOString(),
    to: endOfDay(now).toISOString(),
  });
  const res = await fetch(`/api/events?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`events ${res.status}`);
  }
  return (await res.json()) as CalendarEvent[];
}

type TimedEntry = { kind: "event"; event: CalendarEvent; at: number };
type NowEntry = { kind: "now"; at: number };
type Entry = TimedEntry | NowEntry;

export function WidgetToday({ className, members = [] }: WidgetTodayProps) {
  const t = useTranslations("dashboard.widgets.today");
  const tCal = useTranslations("calendar");
  const now = useNow(30_000);
  const { data: events, isLoading, isError, refetch } = useQuery({
    queryKey: ["events-today"],
    queryFn: fetchTodayEvents,
    staleTime: 60_000,
    // The kiosk mounts this once and never refocuses — poll so phone-made
    // changes appear without waiting for a screensaver cycle.
    refetchInterval: 60_000,
  });

  const membersById = useMemo(() => {
    const map = new Map<string, MemberLite>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const { allDay, bands } = useMemo(() => {
    const list = events ?? [];
    const nowMs = now?.getTime() ?? 0;
    const dayStart = startOfDay(now ?? new Date()).getTime();
    const dayEnd = endOfDay(now ?? new Date()).getTime();

    const allDayEvents: CalendarEvent[] = [];
    const timed: TimedEntry[] = [];
    for (const event of list) {
      const start = new Date(event.startsAt).getTime();
      const end = new Date(event.endsAt).getTime();
      if (event.allDay || (start <= dayStart && end >= dayEnd)) {
        allDayEvents.push(event);
      } else {
        timed.push({ kind: "event", event, at: Math.max(start, dayStart) });
      }
    }
    timed.sort((a, b) => a.at - b.at);

    const entries: Entry[] = [...timed];
    if (now && timed.length > 0) {
      const index = entries.findIndex((e) => e.at > nowMs);
      const marker: NowEntry = { kind: "now", at: nowMs };
      if (index === -1) entries.push(marker);
      else entries.splice(index, 0, marker);
    }

    const grouped = new Map<Band, Entry[]>();
    for (const entry of entries) {
      const band = bandOf(new Date(entry.at));
      grouped.set(band, [...(grouped.get(band) ?? []), entry]);
    }
    return {
      allDay: allDayEvents,
      bands: BAND_ORDER.filter((b) => grouped.has(b)).map((b) => ({
        band: b,
        entries: grouped.get(b) ?? [],
      })),
    };
  }, [events, now]);

  const isEmpty = !isLoading && !isError && (events ?? []).length === 0;

  const bandLabel: Record<Band, string> = {
    MORNING: t("morning"),
    DAY: t("day"),
    EVENING: t("evening"),
  };

  function renderEvent(event: CalendarEvent) {
    const member = membersById.get(event.memberId);
    const color = resolveEventColor(event, member);
    const tone = toneOf(color);
    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);
    const nowMs = now?.getTime() ?? 0;
    const timed = !event.allDay;
    const past = timed && end.getTime() <= nowMs;
    const current = timed && start.getTime() <= nowMs && end.getTime() > nowMs;

    return (
      <li
        key={event.id}
        aria-current={current ? "time" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-3xl border p-2 pr-3 transition-colors duration-kid",
          current
            ? cn("border-[3px] bg-surface shadow-pop", tone.border)
            : "border-border bg-bg/50",
        )}
      >
        <span
          className={cn(
            "relative inline-flex shrink-0 items-center justify-center rounded-2xl",
            tone.tint,
            past ? "size-12" : "size-14",
          )}
        >
          <EventGlyph
            title={event.title}
            color={color}
            date={start}
            size={past ? 40 : 46}
            className={past ? "opacity-70 saturate-50" : undefined}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("kid-title line-clamp-2", past ? "font-medium text-muted" : "text-ink")}>
            {event.title}
          </p>
          <p className="kid-label tabular flex items-center gap-2 text-muted">
            {current && (
              <span className="inline-flex items-center gap-1.5 text-ink">
                <span
                  aria-hidden
                  className={cn("size-2.5 rounded-full motion-safe:animate-pulse", tone.bg)}
                />
                {t("now")}
              </span>
            )}
            <span>
              {event.allDay
                ? tCal("allDay")
                : `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`}
            </span>
          </p>
        </div>
        {member && (
          <MemberAvatar
            name={member.name}
            color={member.color}
            emoji={member.emoji}
            size="sm"
          />
        )}
      </li>
    );
  }

  return (
    <GlassCard className={cn("flex flex-col gap-4 p-6", className)}>
      <WidgetHeader title={t("title")} />

      {isLoading && (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="size-14 shrink-0 rounded-2xl" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="size-10 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {isError && !isLoading && <ErrorState size="md" onRetry={() => void refetch()} detail={t("couldNotLoad")} />}

      {isEmpty && <EmptyState size="md" picto="relax" title={t("empty")} />}

      {!isLoading && !isError && !isEmpty && (
        <div className="flex flex-col gap-4">
          {allDay.length > 0 && (
            <section aria-label={tCal("allDay")} className="flex flex-col gap-2">
              <h3 className="flex h-10 items-center gap-2">
                <Picto name="tod-anytime" size={36} />
                <span className="kid-title text-ink">{tCal("allDay")}</span>
              </h3>
              <ul className="flex flex-col gap-2">{allDay.map(renderEvent)}</ul>
            </section>
          )}
          {bands.map(({ band, entries }) => (
            <section key={band} aria-label={bandLabel[band]} className="flex flex-col gap-2">
              <h3 className="flex h-10 items-center gap-2">
                <Picto name={BAND_PICTO[band]} size={36} />
                <span className="kid-title text-ink">{bandLabel[band]}</span>
              </h3>
              <ul className="flex flex-col gap-2">
                {entries.map((entry) =>
                  entry.kind === "event" ? (
                    renderEvent(entry.event)
                  ) : (
                    <li
                      key="now"
                      className="flex items-center gap-2 px-1"
                      aria-label={`${t("now")} ${format(entry.at, "HH:mm")}`}
                    >
                      <span className="kid-label tabular inline-flex h-7 items-center rounded-full bg-ink px-3 text-bg">
                        {t("now")} {format(entry.at, "HH:mm")}
                      </span>
                      <span aria-hidden className="h-0.5 flex-1 rounded-full bg-ink/70" />
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
