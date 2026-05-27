"use client";

import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Link2, RotateCcw, Trash2 } from "lucide-react";
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

type RecurrenceFreq = "none" | "daily" | "weekly" | "monthly";

export type EditScope = "instance" | "series";

type EventDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: CalendarMember[];
  event: CalendarEvent | null;
  initial?: {
    memberId?: string;
    startsAt?: string;
    endsAt?: string;
    allDay?: boolean;
  };
  onSave: (input: EventCreateInput, eventId: string | null, scope: EditScope | null) => Promise<void>;
  onDelete: (eventId: string, scope: EditScope | null) => Promise<void>;
};

type FormState = {
  memberId: string;
  title: string;
  description: string;
  location: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  color: string;
  recurrence: RecurrenceFreq;
  recurrenceEnd: string;
};

function toLocalDate(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd");
}
function toLocalTime(iso: string): string {
  return format(new Date(iso), "HH:mm");
}

function buildIso(date: string, time: string): string {
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

function parseRrule(rrule: string): { freq: RecurrenceFreq; endDate: string; isCustom: boolean } {
  const upper = rrule.toUpperCase();
  const freqMatch = upper.match(/FREQ=([A-Z]+)/);
  const untilMatch = upper.match(/UNTIL=(\d{8})/);

  let freq: RecurrenceFreq = "none";
  if (freqMatch) {
    if (freqMatch[1] === "DAILY") freq = "daily";
    else if (freqMatch[1] === "WEEKLY") freq = "weekly";
    else if (freqMatch[1] === "MONTHLY") freq = "monthly";
  }

  let endDate = "";
  if (untilMatch) {
    const raw = untilMatch[1]!;
    endDate = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }

  const knownParts = /^FREQ=[A-Z]+(;UNTIL=\d{8}T\d{6}Z)?(;UNTIL=\d{8})?$/;
  const isCustom = !knownParts.test(upper.replace(/\s/g, ""));

  return { freq, endDate, isCustom };
}

function buildRrule(freq: RecurrenceFreq, recurrenceEnd: string): string | null {
  if (freq === "none") return null;
  const freqMap: Record<Exclude<RecurrenceFreq, "none">, string> = {
    daily: "DAILY",
    weekly: "WEEKLY",
    monthly: "MONTHLY",
  };
  let rule = `FREQ=${freqMap[freq]}`;
  if (recurrenceEnd) {
    const d = new Date(recurrenceEnd);
    d.setUTCHours(0, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    const until = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T000000Z`;
    rule += `;UNTIL=${until}`;
  }
  return rule;
}

function defaultState(
  members: CalendarMember[],
  event: CalendarEvent | null,
  initial?: EventDialogProps["initial"],
): FormState {
  if (event) {
    const parsed = event.rrule ? parseRrule(event.rrule) : null;
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
      recurrence: parsed?.freq ?? "none",
      recurrenceEnd: parsed?.endDate ?? "",
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
    recurrence: "none",
    recurrenceEnd: "",
  };
}

const RECURRENCE_OPTIONS: RecurrenceFreq[] = ["none", "daily", "weekly", "monthly"];

type DeleteDialogProps = {
  open: boolean;
  onClose: () => void;
  onDeleteThis: () => void;
  onDeleteSeries: () => void;
  submitting: boolean;
};

function DeleteScopeDialog({ open, onClose, onDeleteThis, onDeleteSeries, submitting }: DeleteDialogProps) {
  const t = useTranslations("calendar.dialog");
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent showClose={false}>
        <div className="flex flex-col gap-5">
          <DialogTitle>{t("deleteScopeQuestion")}</DialogTitle>
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={onDeleteThis}
              className="justify-start min-h-[52px] text-accent-rose hover:bg-accent-rose/10"
            >
              <Trash2 className="size-4 shrink-0" />
              {t("deleteThis")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={onDeleteSeries}
              className="justify-start min-h-[52px] text-accent-rose hover:bg-accent-rose/10"
            >
              <Trash2 className="size-4 shrink-0" />
              {t("deleteSeries")}
            </Button>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={onClose}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
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
  const t = useTranslations("calendar.dialog");
  const [state, setState] = useState<FormState>(() =>
    defaultState(members, event, initial),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<EditScope>("instance");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isGoogle = event?.source === "GOOGLE";
  const isEdit = Boolean(event);
  const isOccurrence = Boolean(event?.seriesId && event.seriesId !== event.id);

  useEffect(() => {
    if (open) {
      setState(defaultState(members, event, initial));
      setError(null);
      setScope("instance");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id, initial?.startsAt, initial?.endsAt, initial?.memberId]);

  const customRrule = useMemo(() => {
    if (!event?.rrule) return false;
    return parseRrule(event.rrule).isCustom;
  }, [event?.rrule]);

  const masterEventId = event?.seriesId ?? event?.id ?? null;

  const selectedMember = useMemo(
    () => members.find((m) => m.id === state.memberId),
    [members, state.memberId],
  );

  const showSeriesWipeWarning =
    isOccurrence &&
    scope === "series" &&
    event != null &&
    (state.recurrence !== (event.rrule ? parseRrule(event.rrule).freq : "none") ||
      state.date !== toLocalDate(event.startsAt) ||
      state.startTime !== toLocalTime(event.startsAt) ||
      state.endDate !== toLocalDate(event.endsAt) ||
      state.endTime !== toLocalTime(event.endsAt));

  function patch(p: Partial<FormState>) {
    setState((prev) => ({ ...prev, ...p }));
  }

  function resolvedScope(): EditScope | null {
    if (!isOccurrence) return null;
    return scope;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!state.memberId) {
      setError(t("memberRequired"));
      return;
    }
    if (!state.title.trim()) {
      setError(t("titleRequired"));
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
      setError(t("endAfterStart"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const effectiveScope = resolvedScope();
      const input: EventCreateInput = {
        memberId: state.memberId,
        title: state.title.trim(),
        description: state.description.trim() || null,
        location: state.location.trim() || null,
        startsAt,
        endsAt,
        allDay: state.allDay,
        color: state.color || null,
        rrule: effectiveScope === "instance" ? null : buildRrule(state.recurrence, state.recurrenceEnd),
      };
      await onSave(input, masterEventId, effectiveScope);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToSave"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!event) return;
    if (isOccurrence) {
      setDeleteDialogOpen(true);
      return;
    }
    if (!window.confirm(t("deleteConfirm"))) return;
    await executeDelete(null);
  }

  async function executeDelete(deleteScope: EditScope | null) {
    if (!event) return;
    setDeleteDialogOpen(false);
    setSubmitting(true);
    setError(null);
    try {
      await onDelete(masterEventId ?? event.id, deleteScope);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToDelete"));
    } finally {
      setSubmitting(false);
    }
  }

  const colorChoices: { value: string; color: MemberColor | null; label: string }[] = [
    {
      value: "",
      color: selectedMember && isMemberColor(selectedMember.color) ? selectedMember.color : null,
      label: t("memberColor"),
    },
    ...MEMBER_COLORS.map((c) => ({ value: c, color: c, label: c })),
  ];

  const recurrenceLabelKey: Record<RecurrenceFreq, string> = {
    none: "recurrenceNever",
    daily: "recurrenceDaily",
    weekly: "recurrenceWeekly",
    monthly: "recurrenceMonthly",
  };

  const memberDisabled = isGoogle || (isOccurrence && scope === "instance");
  const showRecurrencePicker = !isGoogle && !(isOccurrence && scope === "instance");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3 pr-10">
              <DialogTitle>{isEdit ? t("editTitle") : t("newTitle")}</DialogTitle>
            </div>

            {isGoogle && (
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-bg/40 px-3 py-2 text-xs text-muted">
                <Link2 className="size-4 text-accent-sky" />
                {t("googleManaged")}
              </div>
            )}

            {isEdit && isOccurrence && (
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {t("scopeQuestion")}
                </legend>
                <div className="flex flex-col gap-2 pt-1">
                  {(["instance", "series"] as const).map((s) => {
                    const label = s === "instance" ? t("scopeThis") : t("scopeSeries");
                    const selected = scope === s;
                    return (
                      <label
                        key={s}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border px-4 cursor-pointer transition-colors min-h-[52px]",
                          selected
                            ? "border-ink bg-ink/5"
                            : "border-border bg-surface/50 hover:bg-bg",
                        )}
                      >
                        <input
                          type="radio"
                          name="editScope"
                          value={s}
                          checked={selected}
                          onChange={() => setScope(s)}
                          className="size-4 accent-ink shrink-0"
                        />
                        <span className="text-sm font-medium text-ink">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t("title")}
              </label>
              <Input
                value={state.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder={t("whatsHappening")}
                disabled={isGoogle}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t("member")}
              </label>
              <div className={cn("flex flex-wrap gap-2", memberDisabled && "opacity-50 pointer-events-none")}>
                {members.map((m) => {
                  const selected = m.id === state.memberId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => patch({ memberId: m.id })}
                      disabled={memberDisabled}
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
              {isOccurrence && scope === "instance" && (
                <p className="text-xs text-muted">{t("memberSeriesOnly")}</p>
              )}
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
                {t("allDay")}
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {t("startsAt")}
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
                  {t("endsAt")}
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

            {showRecurrencePicker && (
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {t("recurrence")}
                </label>

                {customRrule ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-bg/40 px-3 py-2 text-xs text-muted">
                    <RotateCcw className="size-4 shrink-0" />
                    {t("customRecurrence")}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {RECURRENCE_OPTIONS.map((freq) => (
                        <button
                          key={freq}
                          type="button"
                          onClick={() => patch({ recurrence: freq })}
                          className={cn(
                            "min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors",
                            state.recurrence === freq
                              ? "border-ink bg-ink text-bg"
                              : "border-border bg-surface text-ink hover:bg-bg",
                          )}
                          aria-pressed={state.recurrence === freq}
                        >
                          {t(recurrenceLabelKey[freq] as Parameters<typeof t>[0])}
                        </button>
                      ))}
                    </div>

                    {state.recurrence !== "none" && (
                      <div className="flex items-center gap-3 rounded-2xl border border-border bg-bg/30 px-4 py-3">
                        <label
                          htmlFor="recurrenceEnd"
                          className="text-sm text-ink shrink-0"
                        >
                          {t("recurrenceEnds")}
                        </label>
                        <Input
                          id="recurrenceEnd"
                          type="date"
                          value={state.recurrenceEnd}
                          onChange={(e) => patch({ recurrenceEnd: e.target.value })}
                          placeholder={t("recurrenceForever")}
                          className="text-base flex-1"
                        />
                      </div>
                    )}

                    {showSeriesWipeWarning && (
                      <p className="text-xs text-accent-rose">
                        {t("seriesEditsWipeOverrides")}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t("location")}
              </label>
              <Input
                value={state.location}
                onChange={(e) => patch({ location: e.target.value })}
                placeholder={t("optional")}
                disabled={isGoogle}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t("description")}
              </label>
              <textarea
                value={state.description}
                onChange={(e) => patch({ description: e.target.value })}
                disabled={isGoogle}
                rows={3}
                className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base text-ink placeholder:text-muted focus:ring-2 focus:ring-ink/20 disabled:opacity-50 disabled:pointer-events-none"
                placeholder={t("optional")}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t("color")}
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
                        {t("memberColor")}
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
                    {t("deleteEvent")}
                  </Button>
                )}
                {isEdit && isGoogle && (
                  <span className="text-xs text-muted">{t("deleteInGoogle")}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={submitting}>
                  {t("save")}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {deleteDialogOpen && (
        <DeleteScopeDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onDeleteThis={() => executeDelete("instance")}
          onDeleteSeries={() => executeDelete("series")}
          submitting={submitting}
        />
      )}
    </>
  );
}
