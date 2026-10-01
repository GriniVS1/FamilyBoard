"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Pencil, RotateCw } from "lucide-react";
import { useEffect, useRef, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { toneOf } from "@/components/kids/tone";
import { Picto, usePictoDemo } from "@/components/pictos";
import { MemberAvatar } from "@/components/shared/member-avatar";
import type { ChoreStatus } from "@/lib/chore-state";
import { cn } from "@/lib/utils";
import { ROOMY_MIN_WIDTH, TIGHT_MAX_WIDTH } from "./card-metrics";
import { taskPictoOf } from "./task-picto";
import { useWidth } from "./use-width";
import type { Chore, ChoreMember } from "./types";

export type TaskCardSize = "column" | "focus";

type TaskCardProps = {
  chore: Chore;
  status: ChoreStatus;
  /** Colour of whoever the card belongs to; sand for "for everyone". */
  color: string;
  size?: TaskCardSize;
  failed?: boolean;
  busy?: boolean;
  /** Who did a "for everyone" chore today. */
  stamp?: ChoreMember | null;
  /** Shown only in parent mode. */
  weeklyCompletions?: number | null;
  onPress: (chore: Chore, card: HTMLElement) => void;
  /** Passing this is what reveals the edit button (parent mode only). */
  onEdit?: (chore: Chore) => void;
};

const DEMO_INTERVAL_MS = 12_000;

/** A tap that was deliberately ignored still gets a short answer; nothing changes or moves. */
export const BLOCKED_FEEDBACK =
  "motion-safe:data-[blocked=true]:scale-[0.97] motion-reduce:data-[blocked=true]:opacity-70";

export function TaskCard({
  chore,
  status,
  color,
  size = "column",
  failed = false,
  busy = false,
  stamp = null,
  weeklyCompletions = null,
  onPress,
  onEdit,
}: TaskCardProps) {
  const t = useTranslations("chores");
  const reduced = useReducedMotion();
  const tone = toneOf(color);
  const { play, demoProps } = usePictoDemo();
  const previousStatus = useRef(status);
  const [cardRef, width] = useWidth<HTMLLIElement>();

  const picto = taskPictoOf(chore.icon, chore.title);
  const done = status === "done" && !failed;
  const next = status === "next" && !failed;
  const focus = size === "focus";
  const tight = width !== null && width < TIGHT_MAX_WIDTH;
  const roomy = width !== null && width >= ROOMY_MIN_WIDTH;
  useEffect(() => {
    if (!next || reduced) return;
    const first = window.setTimeout(play, 600);
    const repeat = window.setInterval(play, DEMO_INTERVAL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(repeat);
    };
  }, [next, reduced, play]);

  useEffect(() => {
    if (previousStatus.current !== "done" && status === "done" && !reduced) play();
    previousStatus.current = status;
  }, [status, reduced, play]);

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    onPress(chore, e.currentTarget);
  }

  const surface = failed
    ? "border-dashed border-danger bg-danger-tint text-danger-ink animate-shake-soft"
    : done
      ? cn("border-transparent text-on-accent", tone.bg)
      : next
        ? cn("border-transparent bg-surface text-ink shadow-pop ring-[3px]", tone.ring)
        : "border-border bg-surface text-ink shadow-pop";

  const ringStyle = failed
    ? "border-danger bg-surface"
    : done
      ? "border-transparent bg-surface"
      : next
        ? cn("bg-surface", tone.border)
        : "border-muted/70";

  const tileSize = focus
    ? "size-16 md:size-20"
    : tight
      ? "size-14 md:size-16"
      : "size-14 md:size-[72px]";
  const pictoSize = focus
    ? "size-14 md:size-[72px]"
    : tight
      ? "size-12 md:size-14"
      : "size-12 md:size-16";
  const ringWide = !tight && (focus || roomy);
  const ringSize = tight ? "size-[52px]" : ringWide ? "size-14 md:size-16" : "size-14";

  return (
    <motion.li
      ref={cardRef}
      layout="position"
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      data-task-card=""
      data-chore-card={chore.id}
      data-next={next ? "true" : undefined}
      className="relative scroll-mb-28 scroll-mt-24"
    >
      {next && (
        <span
          aria-hidden
          className="absolute -left-2 -top-2 z-10 flex size-9 items-center justify-center rounded-full bg-surface shadow-pop"
        >
          <Picto name="next" size={26} />
        </span>
      )}
      {failed && (
        <span
          aria-hidden
          className="absolute -left-2 -top-2 z-10 flex size-9 items-center justify-center rounded-full bg-surface shadow-pop"
        >
          <Picto name="oops" size={26} />
        </span>
      )}

      <div
        data-card-surface=""
        className={cn(
          "relative flex items-stretch gap-2 rounded-3xl border-2 transition-[color,background-color,border-color,transform,opacity] duration-kid",
          BLOCKED_FEEDBACK,
          focus ? "h-24 md:h-28" : "h-20 md:h-24",
          surface,
        )}
      >
        <motion.button
          type="button"
          onClick={handleClick}
          aria-pressed={failed ? undefined : done}
          aria-busy={busy || undefined}
          aria-label={
            failed
              ? t("card.retry", { title: chore.title })
              : t("card.label", { title: chore.title, points: chore.points })
          }
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={cn(
            "flex min-w-0 flex-1 items-center rounded-3xl text-left focus-ring-kid",
            tight ? "gap-1.5 p-1.5" : "gap-2 p-2",
          )}
        >
          <span
            {...demoProps}
            className={cn("relative flex shrink-0 items-center justify-center rounded-2xl", tileSize, tone.tint)}
          >
            {picto ? (
              <Picto name={picto} size={64} className={pictoSize} />
            ) : chore.icon ? (
              <span aria-hidden className={cn("leading-none", focus ? "text-5xl" : "text-4xl")}>
                {chore.icon}
              </span>
            ) : (
              <Picto name="star" size={64} className={pictoSize} />
            )}
            {stamp && (
              <MemberAvatar
                size="sm"
                name={stamp.name}
                color={stamp.color}
                emoji={stamp.emoji}
                className="absolute -bottom-2 -right-2 rounded-full bg-surface"
              />
            )}
          </span>

          <span className="flex min-w-0 flex-1 flex-col justify-center">
            <span
              className={cn(
                "line-clamp-2 break-words [hyphens:auto]",
                focus ? "kid-title-lg" : "kid-title",
                next && "font-bold",
                done && "strike-done",
              )}
            >
              {chore.title}
            </span>
            <span className="mt-1 flex items-center gap-1">
              <Picto name="star" size={20} />
              <span className="kid-label tabular">+{chore.points}</span>
              {weeklyCompletions !== null && weeklyCompletions > 0 && (
                <span className="kid-label tabular ml-2 opacity-80">
                  {t("timesThisWeek", { count: weeklyCompletions })}
                </span>
              )}
            </span>
          </span>

          <span
            data-check-ring
            aria-hidden
            className={cn(
              "relative flex shrink-0 items-center justify-center rounded-full border-[3px]",
              ringSize,
              ringStyle,
            )}
          >
            {done && (
              <Check className={cn("size-7 animate-check-pop", tone.ink)} strokeWidth={4} />
            )}
            {failed && <RotateCw className="size-7 text-danger-ink" strokeWidth={3} />}
            {next && <span className="absolute inset-0 animate-next-pulse rounded-full" />}
          </span>
        </motion.button>

        {onEdit && (
          <div className="flex items-center pr-2">
            <button
              type="button"
              onClick={() => onEdit(chore)}
              aria-label={t("card.edit", { title: chore.title })}
              className={cn(
                "inline-flex size-12 items-center justify-center rounded-full border-2 border-border",
                "bg-surface text-ink shadow-pop focus-ring-kid",
                "transition-transform duration-100 ease-snappy active:translate-y-0.5 active:shadow-press",
              )}
            >
              <Pencil className="size-5" strokeWidth={2.25} />
            </button>
          </div>
        )}
      </div>
    </motion.li>
  );
}
