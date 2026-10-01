"use client";

import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Picto, type PictoName } from "@/components/pictos";
import { phaseOf, type DayPhase } from "@/lib/time-of-day";
import { useNow } from "./use-now";

const PHASE_PICTO: Record<DayPhase, PictoName> = {
  MORNING: "tod-morning",
  DAY: "tod-day",
  EVENING: "tod-evening",
  NIGHT: "tod-night",
};

export function TopbarClock() {
  const t = useTranslations("shell");
  const now = useNow(1000);

  return (
    <div className="flex items-center gap-2">
      {now ? <Picto name={PHASE_PICTO[phaseOf(now)]} size={40} /> : <span className="size-10" aria-hidden />}
      <span
        className="kid-title-lg tabular text-ink"
        aria-label={t("currentTime")}
        suppressHydrationWarning
      >
        {now ? format(now, "HH:mm") : "--:--"}
      </span>
    </div>
  );
}
