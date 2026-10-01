"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { toneOf } from "@/components/kids/tone";
import { Picto } from "@/components/pictos";
import { cn } from "@/lib/utils";
import { BLOCKED_FEEDBACK } from "./task-card";
import { taskPictoOf } from "./task-picto";
import type { Chore } from "./types";

type DoneStripProps = {
  chores: readonly Chore[];
  color: string;
  onPress: (chore: Chore, el: HTMLElement) => void;
};

/**
 * Finished chores of a group folded into one row of mini pictures so the open
 * ones stay in view. It sits at the end of the group, below the open cards, so
 * it never pushes the "next" card down. A tap opens the undo toast.
 */
export function DoneStrip({ chores, color, onPress }: DoneStripProps) {
  const t = useTranslations("chores");
  const tone = toneOf(color);

  return (
    <ul className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface/60 p-2">
      {chores.map((chore) => {
        const picto = taskPictoOf(chore.icon, chore.title);
        return (
          <li key={chore.id}>
            <button
              type="button"
              aria-pressed
              aria-label={t("card.doneMini", { title: chore.title })}
              onClick={(e) => onPress(chore, e.currentTarget)}
              className={cn(
                "relative flex size-14 items-center justify-center rounded-2xl focus-ring-kid",
                "transition-[transform,opacity] duration-100 ease-snappy active:scale-95",
                BLOCKED_FEEDBACK,
                tone.tint,
              )}
            >
              {picto ? (
                <Picto name={picto} size={40} />
              ) : chore.icon ? (
                <span aria-hidden className="text-3xl leading-none">
                  {chore.icon}
                </span>
              ) : (
                <Picto name="star" size={40} />
              )}
              <span
                aria-hidden
                className={cn(
                  "absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-surface",
                  tone.bg,
                )}
              >
                <Check className="size-4 text-on-accent" strokeWidth={4} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
