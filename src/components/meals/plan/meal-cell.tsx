"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { MealPlan } from "../types";

type MealCellProps = {
  meal?: MealPlan | null;
  onClick: () => void;
};

const COLOR_PILL: Record<string, string> = {
  peach: "bg-accent-peach/30 text-ink",
  mint: "bg-accent-mint/30 text-ink",
  sun: "bg-accent-sun/30 text-ink",
  sky: "bg-accent-sky/30 text-ink",
  lilac: "bg-accent-lilac/30 text-ink",
  rose: "bg-accent-rose/30 text-ink",
  teal: "bg-accent-teal/30 text-ink",
  sand: "bg-accent-sand/30 text-ink",
};

export function MealCell({ meal, onClick }: MealCellProps) {
  const t = useTranslations("meals");

  const label = meal
    ? (meal.recipe?.name ?? meal.customName ?? "")
    : null;

  const memberColor = meal?.member?.color;
  const memberName = meal?.member?.name;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      aria-label={label ?? t("plan.addMeal")}
      className={cn(
        "tap-target w-full min-h-[72px] flex flex-col items-start justify-center gap-1 px-3 py-2",
        "rounded-2xl border border-border transition-colors",
        meal
          ? "bg-surface hover:bg-bg"
          : "bg-bg hover:bg-surface text-muted",
      )}
    >
      {meal ? (
        <>
          <span className="line-clamp-2 text-left text-sm font-medium text-ink leading-snug">
            {label}
          </span>
          {memberColor && memberName && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                COLOR_PILL[memberColor] ?? "bg-border text-ink",
              )}
            >
              {memberName}
            </span>
          )}
        </>
      ) : (
        <span className="inline-flex items-center gap-1 text-sm">
          <Plus className="size-4" />
          {t("plan.empty")}
        </span>
      )}
    </motion.button>
  );
}
