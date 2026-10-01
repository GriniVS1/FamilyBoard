"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/shared/button";
import { cn } from "@/lib/utils";
import type { CalendarView } from "./types";

type CalendarHeaderProps = {
  title: string;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onCreate: () => void;
};

const STEP_BUTTON =
  "inline-flex size-12 items-center justify-center rounded-full border-2 border-border bg-surface text-ink shadow-pop transition-colors focus-ring-kid active:scale-[0.96] active:shadow-press";

export function CalendarHeader({
  title,
  view,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onCreate,
}: CalendarHeaderProps) {
  const t = useTranslations("calendar");

  const tabs: { value: CalendarView; label: string }[] = [
    { value: "day", label: t("views.day") },
    { value: "week", label: t("views.week") },
    { value: "month", label: t("views.month") },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:justify-between">
      <div className="order-1 flex min-w-0 items-center gap-2 sm:order-none">
        <button type="button" onClick={onPrev} className={STEP_BUTTON} aria-label={t("previous")}>
          <ChevronLeft className="size-6" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={onToday}
          className="kid-label inline-flex h-12 items-center justify-center rounded-full border-2 border-border bg-surface px-5 text-ink shadow-pop transition-colors focus-ring-kid active:scale-[0.96] active:shadow-press"
        >
          {t("today")}
        </button>
        <button type="button" onClick={onNext} className={STEP_BUTTON} aria-label={t("next")}>
          <ChevronRight className="size-6" strokeWidth={2.5} />
        </button>
        <h2 className="ml-2 hidden font-display text-xl font-semibold tracking-tight text-ink sm:block sm:text-2xl">
          {title}
        </h2>
      </div>

      {/* On a phone the title only matters in the month grid, whose head has no date. */}
      {view === "month" && (
        <p
          aria-hidden
          className="order-2 basis-full font-display text-xl font-semibold tracking-tight text-ink sm:hidden"
        >
          {title}
        </p>
      )}

      <div className="contents sm:flex sm:items-center sm:gap-2">
        <div
          role="tablist"
          aria-label={t("viewSwitch")}
          className="order-3 flex w-full gap-2 rounded-full border-2 border-border bg-surface p-1 sm:order-none sm:inline-flex sm:w-auto"
        >
          {tabs.map((tab) => {
            const active = tab.value === view;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onViewChange(tab.value)}
                className={cn(
                  "kid-label h-12 min-w-16 flex-1 rounded-full px-4 transition-colors duration-kid focus-ring-kid sm:flex-none",
                  active ? "bg-ink text-bg shadow-soft" : "text-ink",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <Button
          onClick={onCreate}
          variant="primary"
          size="default"
          aria-label={t("newEvent")}
          className="order-1 ml-auto sm:order-none sm:ml-0"
        >
          <Plus className="size-5" strokeWidth={2.75} />
          <span className="hidden sm:inline">{t("newEvent")}</span>
        </Button>
      </div>
    </div>
  );
}
