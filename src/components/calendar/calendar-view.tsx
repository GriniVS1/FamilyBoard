"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addHours, setHours, setMinutes, setSeconds, startOfDay } from "date-fns";
import { useLocale } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { CalendarHeader } from "./calendar-header";
import { rangeForView, shiftDate, viewLabel } from "./date-utils";
import { EventDialog } from "./event-dialog";
import { MemberFilter } from "./member-filter";
import { ViewDay } from "./view-day";
import { ViewMonth } from "./view-month";
import { ViewWeek } from "./view-week";
import type {
  CalendarEvent,
  CalendarMember,
  CalendarView,
  EventCreateInput,
} from "./types";
import type { EditScope } from "./event-dialog";

type CalendarViewProps = {
  initialMembers: CalendarMember[];
};

type DialogState = {
  open: boolean;
  event: CalendarEvent | null;
  initial?: {
    memberId?: string;
    startsAt?: string;
    endsAt?: string;
    allDay?: boolean;
  };
};

async function fetchEvents(
  from: string,
  to: string,
  memberIds: string[],
  allMemberCount: number,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({ from, to });
  if (memberIds.length > 0 && memberIds.length < allMemberCount) {
    params.set("memberIds", memberIds.join(","));
  }
  const res = await fetch(`/api/events?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `Failed to load events (${res.status})`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data?.error?.message) message = data.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as CalendarEvent[];
}

function detectDefaultView(): CalendarView {
  if (typeof window === "undefined") return "week";
  return window.matchMedia("(max-width: 767px)").matches ? "day" : "week";
}

export function CalendarView({ initialMembers }: CalendarViewProps) {
  const locale = useLocale();
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() =>
    initialMembers.map((m) => m.id),
  );
  const [dialog, setDialog] = useState<DialogState>({ open: false, event: null });

  // After mount adopt mobile vs desktop default
  useEffect(() => {
    setView(detectDefaultView());
  }, []);

  const range = useMemo(() => rangeForView(view, anchor), [view, anchor]);
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const queryClient = useQueryClient();

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ["events", fromIso, toIso, [...selectedMemberIds].sort().join(",")],
    queryFn: () =>
      fetchEvents(fromIso, toIso, selectedMemberIds, initialMembers.length),
    refetchInterval: 60_000, // kiosk never refocuses — poll for remote changes
  });

  const membersById = useMemo(() => {
    const map = new Map<string, CalendarMember>();
    for (const m of initialMembers) map.set(m.id, m);
    return map;
  }, [initialMembers]);

  const saveMutation = useMutation({
    mutationFn: async (args: {
      input: EventCreateInput;
      eventId: string | null;
      scope: EditScope | null;
    }) => {
      let url = args.eventId ? `/api/events/${args.eventId}` : "/api/events";
      if (args.eventId && args.scope) {
        url += `?scope=${args.scope}`;
      }
      const method = args.eventId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args.input),
      });
      if (!res.ok) {
        let message = `Save failed (${res.status})`;
        try {
          const data = (await res.json()) as { error?: { message?: string } };
          if (data?.error?.message) message = data.error.message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      return (await res.json()) as CalendarEvent;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (args: { eventId: string; scope: EditScope | null }) => {
      let url = `/api/events/${args.eventId}`;
      if (args.scope) {
        url += `?scope=${args.scope}`;
      }
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        let message = `Delete failed (${res.status})`;
        try {
          const data = (await res.json()) as { error?: { message?: string } };
          if (data?.error?.message) message = data.error.message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  function handlePrev() {
    setAnchor((a) => shiftDate(view, a, -1));
  }
  function handleNext() {
    setAnchor((a) => shiftDate(view, a, 1));
  }
  function handleToday() {
    setAnchor(new Date());
  }
  function handleCreate(initial?: DialogState["initial"]) {
    setDialog({ open: true, event: null, initial });
  }
  function handleSelectEvent(event: CalendarEvent) {
    setDialog({ open: true, event });
  }
  function handleSelectDay(day: Date) {
    const start = setSeconds(setMinutes(setHours(startOfDay(day), 9), 0), 0);
    const end = addHours(start, 1);
    handleCreate({
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    });
  }
  function handleSelectSlot(day: Date, hour: number) {
    const start = setSeconds(setMinutes(setHours(startOfDay(day), hour), 0), 0);
    const end = addHours(start, 1);
    handleCreate({
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <CalendarHeader
        title={viewLabel(view, anchor, locale)}
        view={view}
        onViewChange={setView}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onCreate={() => handleCreate()}
      />

      <MemberFilter
        members={initialMembers}
        selectedIds={selectedMemberIds}
        onChange={setSelectedMemberIds}
      />

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-accent-rose/40 bg-accent-rose/10 px-4 py-3 text-sm text-ink"
        >
          {error instanceof Error ? error.message : "Could not load events."}
        </div>
      )}

      <div className="relative">
        {isLoading && (
          <div className="absolute right-2 top-2 z-10 rounded-full bg-bg/70 px-3 py-1 text-xs text-muted">
            Loading…
          </div>
        )}
        {view === "month" && (
          <ViewMonth
            anchor={anchor}
            events={events}
            membersById={membersById}
            onSelectEvent={handleSelectEvent}
            onSelectDay={handleSelectDay}
          />
        )}
        {view === "week" && (
          <ViewWeek
            anchor={anchor}
            events={events}
            membersById={membersById}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
          />
        )}
        {view === "day" && (
          <ViewDay
            anchor={anchor}
            events={events}
            membersById={membersById}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
          />
        )}
      </div>

      <EventDialog
        open={dialog.open}
        onOpenChange={(o) =>
          setDialog((d) => ({ ...d, open: o, event: o ? d.event : null }))
        }
        members={initialMembers}
        event={dialog.event}
        initial={dialog.initial}
        onSave={async (input, eventId, scope) => {
          await saveMutation.mutateAsync({ input, eventId, scope });
        }}
        onDelete={async (eventId, scope) => {
          await deleteMutation.mutateAsync({ eventId, scope });
        }}
      />
    </div>
  );
}
