"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { endOfDay, format, startOfDay } from "date-fns";
import { useMemo } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { COLOR_DOT } from "@/components/calendar/types";
import type { CalendarEvent } from "@/components/calendar/types";
import { cn, isMemberColor, type MemberColor } from "@/lib/utils";
import { WidgetHeader } from "./widget-header";

type MemberLite = {
  id: string;
  name: string;
  color: string;
};

type WidgetTodayProps = {
  className?: string;
  members?: MemberLite[];
};

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
    throw new Error(`Failed to load today's events (${res.status})`);
  }
  return (await res.json()) as CalendarEvent[];
}

function dotColor(event: CalendarEvent, members: Map<string, MemberLite>): MemberColor {
  const candidate =
    event.color ?? members.get(event.memberId)?.color ?? "sand";
  return isMemberColor(candidate) ? candidate : "sand";
}

export function WidgetToday({ className, members = [] }: WidgetTodayProps) {
  const t = useTranslations("dashboard.widgets.today");
  const tCal = useTranslations("calendar");
  const { data: events, isLoading, error } = useQuery({
    queryKey: ["events-today"],
    queryFn: fetchTodayEvents,
    staleTime: 60_000,
  });

  const membersById = useMemo(() => {
    const map = new Map<string, MemberLite>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return (events ?? [])
      .filter((e) => new Date(e.endsAt).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      )
      .slice(0, 4);
  }, [events]);

  const next = upcoming[0];

  return (
    <GlassCard className={cn("p-6 flex flex-col gap-4", className)}>
      <WidgetHeader title={t("title")} />
      <div>
        <span className="font-display text-2xl text-ink">
          {next ? next.title : t("noEventsToday")}
        </span>
        <p className="mt-1 text-sm text-muted">
          {next
            ? `${format(new Date(next.startsAt), "HH:mm")} – ${format(
                new Date(next.endsAt),
                "HH:mm",
              )}`
            : "—"}
        </p>
      </div>
      <ul className="flex flex-1 flex-col gap-2" aria-label={t("title")}>
        {isLoading && (
          <li className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            {t("empty")}
          </li>
        )}
        {!isLoading && error && (
          <li className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-accent-rose/40 px-4 py-8 text-center text-sm text-accent-rose">
            {t("couldNotLoad")}
          </li>
        )}
        {!isLoading && !error && upcoming.length === 0 && (
          <li className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            {t("empty")}
          </li>
        )}
        {upcoming.map((e) => {
          const color = dotColor(e, membersById);
          const member = membersById.get(e.memberId);
          return (
            <li
              key={e.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-bg/30 px-3 py-2"
            >
              <span className="text-xs font-medium tabular text-muted w-12 shrink-0">
                {e.allDay ? tCal("allDay") : format(new Date(e.startsAt), "HH:mm")}
              </span>
              <span
                aria-hidden
                className={cn("size-2.5 rounded-full shrink-0", COLOR_DOT[color])}
                title={member?.name}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink truncate">
                  {e.title}
                </div>
                {e.location && (
                  <div className="text-xs text-muted truncate">
                    {e.location}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}
