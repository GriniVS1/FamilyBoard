"use client";

import { format } from "date-fns";
import { Link2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { Input } from "@/components/shared/input";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { MemberColorSwatch } from "@/components/shared/member-color-swatch";
import { cn, MEMBER_COLORS, isMemberColor, type MemberColor } from "@/lib/utils";
import type { CalendarEvent, CalendarMember, EventCreateInput } from "./types";

type EventDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: CalendarMember[];
  /** Existing event to edit, or null for create */
  event: CalendarEvent | null;
  /** Pre-fill values when creating a new event */
  initial?: {
    memberId?: string;
    startsAt?: string;
    endsAt?: string;
    allDay?: boolean;
  };
  onSave: (input: EventCreateInput, eventId: string | null) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
};

type FormState = {
  memberId: string;
  title: string;
  description: string;
  location: string;
  date: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (used for all-day end inclusive)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  allDay: boolean;
  color: string; // "" means use member color
};

function toLocalDate(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd");
}
function toLocalTime(iso: string): string {
  return format(new Date(iso), "HH:mm");
}

function buildIso(date: string, time: string): string {
  // build local date from yyyy-MM-dd + HH:mm
  const [y, m, d] = date.split("-").map((s) => parseInt(s, 10));
  const [hh, mm] = time.split(":").map((s) => parseInt(s, 10));
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  return dt.toISOString();
}

function buildAllDayIso(date: string, endOfDay: boolean): string {
  const [y, m, d] = date.split("-").map((s) => parseInt(s, 10));
  const dt = endOfDay
    ? new Date(y!, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999)
    : new Date(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
  return dt.toISOString();
}

function defaultState(
  members: CalendarMember[],
  event: CalendarEvent | null,
  initial?: EventDialogProps["initial"],
): FormState {
  if (event) {
    return {
      memberId: event.memberId,
      title: event.title,
      description: event.description ?? "",
      location: event.location ?? "",
      date: toLocalDate(event.startsAt),
      endDate: toLocalDate(event.endsAt),
      startTime: toLocalTime(event.startsAt),
      endTime: toLocalTime(event.endsAt),
      allDay: event.allDay,
      color: event.color ?? "",
    };
  }
  const today = new Date();
  const start = initial?.startsAt ? new Date(initial.startsAt) : today;
  const end = initial?.endsAt
    ? new Date(initial.endsAt)
    : new Date(start.getTime() + 60 * 60 * 1000);
  return {
    memberId: initial?.memberId ?? members[0]?.id ?? "",
    title: "",
    description: "",
    location: "",
    date: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
    startTime: format(start, "HH:mm"),
    endTime: format(end, "HH:mm"),
    allDay: initial?.allDay ?? false,
    color: "",
  };
}

export function EventDialog({
  open,
  onOpenChange,
  members,
  event,
  initial,
  onSave,
  onDelete,
}: EventDialogProps) {
  const [state, setState] = useState<FormState>(() =>
    defaultState(members, event, initial),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setState(defaultState(members, event, initial));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id, initial?.startsAt, initial?.endsAt, initial?.memberId]);

  const isGoogle = event?.source === "GOOGLE";
  const isEdit = Boolean(event);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === state.memberId),
    [members, state.memberId],
  );

  function patch(p: Partial<FormState>) {
    setState((prev) => ({ ...prev, ...p }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!state.memberId) {
      setError("Pick a member.");
      return;
    }
    if (!state.title.trim()) {
      setError("Title is required.");
      return;
    }

    let startsAt: string;
    let endsAt: string;
    if (state.allDay) {
      startsAt = buildAllDayIso(state.date, false);
      endsAt = buildAllDayIso(state.endDate || state.date, true);
    } else {
      startsAt = buildIso(state.date, state.startTime);
      endsAt = buildIso(state.endDate || state.date, state.endTime);
    }

    if (new Date(endsAt) <= new Date(startsAt)) {
      setError("End must be after start.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const input: EventCreateInput = {
        memberId: state.memberId,
        title: state.title.trim(),
        description: state.description.trim() || null,
        location: state.location.trim() || null,
        startsAt,
        endsAt,
        allDay: state.allDay,
        color: state.color || null,
      };
      await onSave(input, event?.id ?? null);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!event) return;
    if (!window.confirm("Delete this event?")) return;
    setSubmitting(true);
    setError(null);
    try {
      await onDelete(event.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setSubmitting(false);
    }
  }

  const colorChoices: { value: string; color: MemberColor | null; label: string }[] = [
    {
      value: "",
      color: selectedMember && isMemberColor(selectedMember.color) ? selectedMember.color : null,
      label: "Member color",
    },
    ...MEMBER_COLORS.map((c) => ({ value: c, color: c, label: c })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3 pr-10">
            <DialogTitle>{isEdit ? "Edit event" : "New event"}</DialogTitle>
          </div>

          {isGoogle && (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-bg/40 px-3 py-2 text-xs text-muted">
              <Link2 className="size-4 text-accent-sky" />
              Synced from Google Calendar — only Member and Color can be changed.
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              Title
            </label>
            <Input
              value={state.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="What's happening?"
              disabled={isGoogle}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              Member
            </label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const selected = m.id === state.memberId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => patch({ memberId: m.id })}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full pl-1 pr-3 py-1 tap-target border transition-colors",
                      selected
                        ? "border-ink bg-surface shadow-soft"
                        : "border-border bg-surface/50 opacity-70 hover:opacity-100",
                    )}
                    aria-pressed={selected}
                  >
                    <MemberAvatar
                      name={m.name}
                      color={m.color}
                      emoji={m.emoji}
                      className="size-9 border-0"
                    />
                    <span className="text-sm text-ink">{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-border bg-bg/30 px-4 py-3">
            <input
              id="allDay"
              type="checkbox"
              checked={state.allDay}
              onChange={(e) => patch({ allDay: e.target.checked })}
              disabled={isGoogle}
              className="size-5 accent-ink"
            />
            <label htmlFor="allDay" className="text-sm text-ink">
              All day
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                Start
              </label>
              <Input
                type="date"
                value={state.date}
                onChange={(e) => patch({ date: e.target.value })}
                disabled={isGoogle}
                className="text-base"
              />
              {!state.allDay && (
                <Input
                  type="time"
                  value={state.startTime}
                  onChange={(e) => patch({ startTime: e.target.value })}
                  disabled={isGoogle}
                  className="text-base tabular"
                />
              )}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                End
              </label>
              <Input
                type="date"
                value={state.endDate || state.date}
                onChange={(e) => patch({ endDate: e.target.value })}
                disabled={isGoogle}
                className="text-base"
              />
              {!state.allDay && (
                <Input
                  type="time"
                  value={state.endTime}
                  onChange={(e) => patch({ endTime: e.target.value })}
                  disabled={isGoogle}
                  className="text-base tabular"
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              Location
            </label>
            <Input
              value={state.location}
              onChange={(e) => patch({ location: e.target.value })}
              placeholder="Optional"
              disabled={isGoogle}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              Notes
            </label>
            <textarea
              value={state.description}
              onChange={(e) => patch({ description: e.target.value })}
              disabled={isGoogle}
              rows={3}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base text-ink placeholder:text-muted focus:ring-2 focus:ring-ink/20 disabled:opacity-50 disabled:pointer-events-none"
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {colorChoices.map((c) => {
                const selected = c.value === state.color;
                if (c.value === "") {
                  return (
                    <button
                      key="default"
                      type="button"
                      onClick={() => patch({ color: "" })}
                      className={cn(
                        "h-12 tap-target rounded-full border px-4 text-sm transition-colors",
                        selected
                          ? "bg-ink text-bg border-ink"
                          : "bg-surface text-ink border-border hover:bg-bg",
                      )}
                      aria-pressed={selected}
                    >
                      Member color
                    </button>
                  );
                }
                return (
                  <MemberColorSwatch
                    key={c.value}
                    color={c.color as MemberColor}
                    selected={selected}
                    onClick={() => patch({ color: c.value })}
                  />
                );
              })}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-accent-rose">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <div>
              {isEdit && !isGoogle && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={submitting}
                  className="text-accent-rose hover:bg-accent-rose/10"
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              )}
              {isEdit && isGoogle && (
                <span className="text-xs text-muted">Delete in Google Calendar</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
