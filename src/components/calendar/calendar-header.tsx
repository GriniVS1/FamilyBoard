"use client";

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

const TABS: { value: CalendarView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export function CalendarHeader({
  title,
  view,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onCreate,
}: CalendarHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="size-12 tap-target inline-flex items-center justify-center rounded-full border border-border bg-surface text-ink hover:bg-bg transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={onToday}
          className="h-12 tap-target inline-flex items-center justify-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-ink hover:bg-bg transition-colors"
        >
          Today
        </button>
        <button
          type="button"
          onClick={onNext}
          className="size-12 tap-target inline-flex items-center justify-center rounded-full border border-border bg-surface text-ink hover:bg-bg transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="size-5" />
        </button>
        <h2 className="ml-2 font-display text-xl sm:text-2xl tracking-tight text-ink">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <div
          role="tablist"
          aria-label="View"
          className="inline-flex rounded-full border border-border bg-surface p-1"
        >
          {TABS.map((tab) => {
            const active = tab.value === view;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onViewChange(tab.value)}
                className={cn(
                  "h-10 min-w-[64px] tap-target rounded-full px-4 text-sm font-medium transition-colors",
                  active
                    ? "bg-ink text-bg shadow-soft"
                    : "text-muted hover:text-ink",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <Button onClick={onCreate} variant="primary" size="default">
          <Plus className="size-5" />
          <span className="hidden sm:inline">New event</span>
        </Button>
      </div>
    </div>
  );
}
