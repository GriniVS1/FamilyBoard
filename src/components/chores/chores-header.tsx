"use client";

import { Check, Plus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { ParentModeToggle, useParentMode } from "@/components/kids/parent-mode";
import { toneOf } from "@/components/kids/tone";
import { Picto } from "@/components/pictos";
import { MemberAvatar } from "@/components/shared/member-avatar";
import type { ColumnSummary } from "@/lib/chore-state";
import type { DayPhase } from "@/lib/time-of-day";
import { cn } from "@/lib/utils";
import { BLOCKED_FEEDBACK } from "./task-card";
import { taskPictoOf } from "./task-picto";
import { PHASE_PICTO } from "./time-of-day-header";
import type { Chore, ChoreMember } from "./types";

const MAX_ANYONE_CHIPS = 4;

export type AnyoneItem = { chore: Chore; done: boolean; stamp: ChoreMember | null };

const PHASE_TINT: Record<DayPhase, string> = {
  MORNING: "bg-accent-peach-tint",
  DAY: "bg-accent-sun-tint",
  EVENING: "bg-accent-lilac-tint",
  NIGHT: "bg-accent-sky-tint",
};

type ChoresHeaderProps = {
  members: readonly ChoreMember[];
  summaries: ReadonlyMap<string, ColumnSummary<Chore>>;
  focusId: string | null;
  phase: DayPhase | null;
  wall: boolean;
  /** "For everyone" chores (open first), shown as picture chips so they need no scrolling. */
  anyone: readonly AnyoneItem[];
  /** The person focus already lists them at the bottom, so the chips stay away. */
  inFocus: boolean;
  onAnyonePress: (chore: Chore, el: HTMLElement) => void;
  onAnyoneGo: () => void;
  /** Last successful data is still shown but refreshing failed. */
  stale: boolean;
  onRetry: () => void;
  onFocus: (memberId: string | null) => void;
  onNew: () => void;
};

export function ChoresHeader({
  members,
  summaries,
  focusId,
  phase,
  wall,
  anyone,
  inFocus,
  onAnyonePress,
  onAnyoneGo,
  stale,
  onRetry,
  onFocus,
  onNew,
}: ChoresHeaderProps) {
  const t = useTranslations("chores");
  const tKids = useTranslations("kids");
  const tPicto = useTranslations("pictos");
  const { active } = useParentMode();
  const phasePicto = phase ? PHASE_PICTO[phase] : null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex w-full min-w-0 items-center gap-2 md:w-auto md:gap-3">
        <button
          type="button"
          onClick={() => onFocus(null)}
          aria-pressed={focusId === null}
          aria-label={t("allA11y")}
          className={cn(
            "inline-flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-2",
            "kid-label text-ink focus-ring-kid md:w-auto md:flex-row md:gap-2 md:px-5",
            "transition-transform duration-100 ease-snappy active:translate-y-0.5",
            focusId === null ? "border-ink bg-surface shadow-pop" : "border-border bg-surface/70",
          )}
        >
          <Users className="size-6 md:size-7" strokeWidth={2.25} aria-hidden />
          <span>{t("all")}</span>
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-2 [scrollbar-width:none] md:-mx-1 md:flex-none md:px-1 [&::-webkit-scrollbar]:hidden">
          {members.map((m) => {
            const summary = summaries.get(m.id);
            const selected = focusId === m.id;
            const dimmed = focusId !== null && !selected;
            const tone = toneOf(m.color);
            const hasChores = Boolean(summary && summary.total > 0);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onFocus(selected ? null : m.id)}
                aria-pressed={selected}
                aria-label={t("focusOn", { name: m.name })}
                data-avatar-target={m.id}
                className={cn(
                  "flex min-h-16 min-w-16 shrink-0 flex-col items-center gap-0.5 rounded-3xl p-1 md:p-1.5",
                  "focus-ring-kid transition-[transform,background-color] duration-kid ease-snappy",
                  selected ? "scale-105 bg-surface shadow-pop" : "active:scale-95",
                  dimmed && "scale-90 opacity-70",
                )}
              >
                <MemberAvatar
                  size={wall ? "lg" : "md"}
                  name={m.name}
                  color={m.color}
                  emoji={m.emoji}
                  progress={hasChores && summary ? { done: summary.done, total: summary.total } : undefined}
                  openCount={hasChores && summary ? summary.open : undefined}
                />
                <span
                  aria-hidden
                  className={cn(
                    "kid-label line-clamp-1 max-w-20 break-words",
                    selected ? tone.ink : "text-ink",
                  )}
                >
                  {m.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {anyone.length > 0 && !inFocus && (
        <div className="flex min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-3xl border-2 border-dashed border-border bg-surface/60 p-1.5">
          <button
            type="button"
            onClick={onAnyoneGo}
            aria-label={t("anyoneGo")}
            className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-muted",
              "bg-surface text-ink focus-ring-kid transition-transform duration-100 ease-snappy active:scale-95",
            )}
          >
            <Users className="size-6" strokeWidth={2} aria-hidden />
          </button>
          {anyone.slice(0, MAX_ANYONE_CHIPS).map(({ chore, done, stamp }) => {
            const picto = taskPictoOf(chore.icon, chore.title);
            return (
              <button
                key={chore.id}
                type="button"
                onClick={(e) => onAnyonePress(chore, e.currentTarget)}
                aria-label={done ? t("card.doneMini", { title: chore.title }) : t("anyoneChip", { title: chore.title })}
                aria-pressed={done}
                className={cn(
                  "relative flex size-14 shrink-0 items-center justify-center rounded-2xl focus-ring-kid",
                  "transition-[transform,opacity] duration-100 ease-snappy active:scale-95",
                  BLOCKED_FEEDBACK,
                  done && stamp ? toneOf(stamp.color).tint : "bg-accent-sand-tint",
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
                {done && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -bottom-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full border-2 border-surface",
                      stamp ? toneOf(stamp.color).bg : "bg-success",
                    )}
                  >
                    <Check className="size-4 text-on-accent" strokeWidth={4} />
                  </span>
                )}
              </button>
            );
          })}
          {anyone.length > MAX_ANYONE_CHIPS && (
            <button
              type="button"
              onClick={onAnyoneGo}
              aria-label={t("anyoneMore")}
              className="kid-label tabular flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent-sand-tint text-accent-sand-ink focus-ring-kid"
            >
              +{anyone.length - MAX_ANYONE_CHIPS}
            </button>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        {stale && (
          <button
            type="button"
            onClick={onRetry}
            aria-label={tKids("retry")}
            className="inline-flex size-12 items-center justify-center rounded-full bg-danger-tint focus-ring-kid"
          >
            <Picto name="oops" size={32} />
          </button>
        )}
        {phasePicto && phase && (
          <span
            role="img"
            aria-label={tPicto(phasePicto)}
            className={cn("hidden size-14 items-center justify-center rounded-2xl md:flex", PHASE_TINT[phase])}
          >
            <Picto name={phasePicto} size={44} />
          </span>
        )}
        {active ? (
          <button
            type="button"
            onClick={onNew}
            className={cn(
              "inline-flex h-12 items-center gap-2 rounded-full bg-accent-sky px-5 kid-label text-on-accent",
              "shadow-pop focus-ring-kid transition-transform duration-100 ease-snappy active:translate-y-0.5 active:shadow-press",
            )}
          >
            <Plus className="size-5" strokeWidth={2.75} aria-hidden />
            <span>{t("addChore")}</span>
          </button>
        ) : (
          <ParentModeToggle />
        )}
      </div>
    </div>
  );
}
