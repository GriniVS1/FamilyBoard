"use client";

import { motion } from "framer-motion";
import { Check, Pencil, Star } from "lucide-react";
import { useRef, type MouseEvent, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { cn, isMemberColor, type MemberColor } from "@/lib/utils";
import type { Chore } from "./types";
import { TINT_BG, TINT_BG_STRONG } from "./types";

type ChoreRowProps = {
  chore: Chore;
  weeklyCompletions: number;
  color: string;
  pending: boolean;
  onComplete: (chore: Chore, x: number, y: number) => void;
  onEdit: (chore: Chore) => void;
};

export function ChoreRow({
  chore,
  weeklyCompletions,
  color,
  pending,
  onComplete,
  onEdit,
}: ChoreRowProps) {
  const t = useTranslations("chores");
  const tCommon = useTranslations("common");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const safeColor: MemberColor = isMemberColor(color) ? color : "sand";

  function handleClick(e: MouseEvent<HTMLButtonElement> | PointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const node = buttonRef.current;
    let x: number;
    let y: number;
    if (node) {
      const rect = node.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    } else {
      x = window.innerWidth / 2;
      y = window.innerHeight / 2;
    }
    onComplete(chore, x, y);
  }

  function handleEdit(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    onEdit(chore);
  }

  return (
    <li
      className={cn(
        "group flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2 sm:px-4 sm:py-3",
        "transition-colors hover:bg-bg/40",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl",
          TINT_BG[safeColor],
        )}
      >
        {chore.icon ?? "✨"}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-base font-medium text-ink">
            {chore.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-ink",
              TINT_BG_STRONG[safeColor],
            )}
          >
            <Star className="size-3 fill-current text-accent-sun" strokeWidth={0} />
            <span className="tabular">{chore.points}</span>
          </span>
          {weeklyCompletions > 0 && (
            <span className="tabular text-xs text-muted">
              {t("timesThisWeek", { count: weeklyCompletions })}
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleEdit}
        className={cn(
          "size-12 tap-target inline-flex items-center justify-center rounded-full text-muted",
          "opacity-0 transition-opacity hover:bg-bg hover:text-ink group-hover:opacity-100 focus:opacity-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
        )}
        aria-label={`${tCommon("edit")} ${chore.title}`}
      >
        <Pencil className="size-4" />
      </button>

      <motion.button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        disabled={pending}
        whileTap={{ scale: 0.9 }}
        transition={{ type: "spring", stiffness: 400, damping: 24 }}
        className={cn(
          "relative size-12 tap-target inline-flex items-center justify-center rounded-full",
          "border border-border bg-surface text-ink shadow-soft",
          "hover:bg-accent-sun/30 disabled:opacity-60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30",
        )}
        aria-label={`${tCommon("done")} ${chore.title}`}
      >
        <Check className="size-5" />
      </motion.button>
    </li>
  );
}
