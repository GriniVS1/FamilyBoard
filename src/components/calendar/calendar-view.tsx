"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addHours, setHours, setMinutes, setSeconds, startOfDay } from "date-fns";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { KidToast } from "@/components/kids/kid-toast";
import { ErrorState } from "@/components/kids/state-views";
import { resolveEventPicto } from "@/components/pictos";
import { CalendarHeader } from "./calendar-header";
import { HOUR_END, HOUR_START, isToday, rangeForView, shiftDate, viewLabel } from "./date-utils";
import { slotHeightPx } from "./layout-utils";
import { useFillHeight } from "./use-fill-height";
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

// Fetched for everybody and filtered on the client, so switching the person
// filter never empties the grid while a new request is in flight.
async function fetchEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({ from, to });
  const res = await fetch(`/api/events?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`events ${res.status}`);
  }
  return (await res.json()) as CalendarEvent[];
}

const MIN_GRID_PX = 340;

function detectDefaultView(): CalendarView {
  if (typeof window === "undefined") return "week";
  // Below the wall size 7 week columns are too narrow to read a title.
  return window.matchMedia("(max-width: 1023px)").matches ? "day" : "week";
}

export function CalendarView({ initialMembers }: CalendarViewProps) {
  const locale = useLocale();
  const t = useTranslations("calendar");
  const tKids = useTranslations("kids");
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() =>
    initialMembers.map((m) => m.id),
  );
  const [dialog, setDialog] = useState<DialogState>({ open: false, event: null });
  const [undoEvent, setUndoEvent] = useState<CalendarEvent | null>(null);
  const [scrollRef, gridHeight] = useFillHeight<HTMLDivElement>(MIN_GRID_PX);
  const gridReady = gridHeight !== undefined;
  const scrollHourRef = useRef<number | null>(null);
  const [scrollTick, setScrollTick] = useState(0);

  // After mount adopt mobile vs desktop default
  useEffect(() => {
    setView(detectDefaultView());
  }, []);

  // Only the grid box scrolls, never the page: date navigation, view switch and
  // the person filter stay on screen. Runs on open, on view change, on "Today"
  // and for "+N" blocks — not on every week step, which would fight the user.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !gridReady || view === "month") return;
    const explicit = scrollHourRef.current;
    scrollHourRef.current = null;
    if (explicit === null && !isToday(anchor)) return;
    const hour = Math.min(HOUR_END, (explicit ?? new Date().getHours()) - 1);
    const grid = scroller.querySelector<HTMLElement>("[data-timed-grid]");
    if (!grid) return;
    const head = scroller.querySelector<HTMLElement>("[data-calendar-head]");
    const gridTop =
      grid.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    const top =
      hour <= HOUR_START
        ? 0
        : gridTop + (hour - HOUR_START) * slotHeightPx() - (head?.offsetHeight ?? 0);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({ top: Math.max(0, top), behavior: reduced ? "auto" : "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, scrollTick, gridReady]);

  const range = useMemo(() => rangeForView(view, anchor), [view, anchor]);
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const queryClient = useQueryClient();

  const {
    data: allEvents = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["events", fromIso, toIso],
    queryFn: () => fetchEvents(fromIso, toIso),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000, // kiosk never refocuses — poll for remote changes
  });

  const events = useMemo(() => {
    const visible = new Set(selectedMemberIds);
    return allEvents.filter((e) => visible.has(e.memberId));
  }, [allEvents, selectedMemberIds]);

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
        throw new Error(`save ${res.status}`);
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
        throw new Error(`delete ${res.status}`);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (event: CalendarEvent) => {
      const input: EventCreateInput = {
        memberId: event.memberId,
        title: event.title,
        description: event.description,
        location: event.location,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        allDay: event.allDay,
        color: event.color,
      };
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`restore ${res.status}`);
    },
    onSettled: () => {
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
    setScrollTick((n) => n + 1);
  }
  function handleOpenDay(day: Date, hour: number) {
    scrollHourRef.current = hour;
    setAnchor(day);
    setView("day");
    setScrollTick((n) => n + 1);
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

      {isError && !isLoading && <ErrorState size="md" onRetry={() => void refetch()} />}

      <div className="relative">
        {isLoading && (
          <div
            role="status"
            className="kid-label absolute right-2 top-2 z-40 inline-flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1 text-muted shadow-soft"
          >
            <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
            {tKids("loading")}
          </div>
        )}
        <div
          ref={scrollRef}
          className="overflow-y-auto overscroll-contain rounded-3xl border border-border bg-surface"
          style={{ height: gridHeight }}
        >
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
              onOpenDay={handleOpenDay}
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
          {view !== "month" && gridHeight !== undefined && (
            // Room below midnight, so "now" stays in the upper two thirds of the box
            // until midnight instead of being pinned to the bottom edge.
            <div aria-hidden style={{ height: Math.ceil(gridHeight * 0.4) }} />
          )}
        </div>
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
          const removed = events.find((e) => e.id === eventId);
          await deleteMutation.mutateAsync({ eventId, scope });
          // Recurring or synced events cannot be recreated faithfully, so only
          // plain local ones get an undo.
          if (removed && removed.source === "LOCAL" && !removed.rrule && !removed.seriesId) {
            setUndoEvent(removed);
          }
        }}
      />

      {undoEvent && (
        <KidToast
          tone="success"
          picto={resolveEventPicto(null, undoEvent.title) ?? "nav-calendar"}
          durationMs={8000}
          action={{
            kind: "undo",
            onClick: () => restoreMutation.mutate(undoEvent),
          }}
          onDismiss={() => setUndoEvent(null)}
        >
          {t("eventDeleted")}
        </KidToast>
      )}
    </div>
  );
}
