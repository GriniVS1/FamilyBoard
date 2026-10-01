"use client";

import { Fragment, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfWeek,
  addDays,
  addWeeks,
  format,
  isSameDay,
} from "date-fns";
import { cn } from "@/lib/utils";
import { MealCell } from "./meal-cell";
import { MealDialog } from "./meal-dialog";
import { MEAL_SLOTS as SLOTS } from "../types";
import type {
  MealPlan,
  MealSlot,
  MealMember,
  Recipe,
  MealCreateInput,
} from "../types";

type WeekPlanProps = {
  meals: MealPlan[];
  recipes: Recipe[];
  members: MealMember[];
  weekOffset: number;
  onWeekOffsetChange: (offset: number) => void;
  onSave: (input: MealCreateInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

type DialogState = {
  date: string;
  slot: MealSlot;
  existing?: MealPlan | null;
} | null;

export function WeekPlan({
  meals,
  recipes,
  members,
  weekOffset,
  onWeekOffsetChange,
  onSave,
  onDelete,
}: WeekPlanProps) {
  const t = useTranslations("meals");
  const locale = useLocale();
  const [dialog, setDialog] = useState<DialogState>(null);
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const rangeFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), {
    weekStartsOn: 1,
  });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function mealsFor(date: Date, slot: MealSlot): MealPlan | undefined {
    const iso = format(date, "yyyy-MM-dd");
    return meals.find(
      (m) => m.date.startsWith(iso) && m.slot === slot,
    );
  }

  function openDialog(date: Date, slot: MealSlot) {
    const iso = format(date, "yyyy-MM-dd");
    const existing = mealsFor(date, slot);
    setDialog({ date: iso, slot, existing });
  }

  const today = new Date();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl tracking-tight text-ink">
          {t("plan.weeklyTitle")}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onWeekOffsetChange(weekOffset - 1)}
            className="tap-target inline-flex items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5 focus-ring-kid"
            aria-label={t("plan.previousWeek")}
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="kid-label tabular px-2 text-muted">
            {rangeFmt.format(weekStart)} – {rangeFmt.format(addDays(weekStart, 6))}
          </span>
          <button
            type="button"
            onClick={() => onWeekOffsetChange(weekOffset + 1)}
            className="tap-target inline-flex items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5 focus-ring-kid"
            aria-label={t("plan.nextWeek")}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 md:-mx-0">
        <div className="min-w-[760px] px-4 md:px-0">
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `104px repeat(7, 1fr)` }}
          >
            <div />
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "py-2 text-center text-xs font-semibold uppercase tracking-wide",
                  isSameDay(day, today) ? "text-accent-peach-ink" : "text-muted",
                )}
              >
                <div>{weekdayFmt.format(day)}</div>
                <div
                  className={cn(
                    "mx-auto mt-0.5 flex size-8 items-center justify-center rounded-full tabular text-base font-bold",
                    isSameDay(day, today)
                      ? "bg-accent-peach-tint text-accent-peach-ink ring-2 ring-accent-peach"
                      : "text-ink",
                  )}
                >
                  {format(day, "d")}
                </div>
              </div>
            ))}

            {SLOTS.map((slot) => (
              <Fragment key={slot}>
                <div className="kid-label flex items-center py-1 pr-2 text-muted">
                  {t(`plan.slots.${slot.toLowerCase()}` as Parameters<typeof t>[0])}
                </div>
                {days.map((day) => (
                  <div key={`${slot}-${day.toISOString()}`} className="py-1">
                    <MealCell
                      meal={mealsFor(day, slot)}
                      onClick={() => openDialog(day, slot)}
                    />
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {dialog && (
        <MealDialog
          open
          onOpenChange={(v) => { if (!v) setDialog(null); }}
          date={dialog.date}
          slot={dialog.slot}
          existing={dialog.existing}
          recipes={recipes}
          members={members}
          onSave={onSave}
          onDelete={
            dialog.existing
              ? async () => {
                  await onDelete(dialog.existing!.id);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
