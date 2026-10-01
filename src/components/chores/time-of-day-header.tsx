"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { toneOf } from "@/components/kids/tone";
import { Picto, usePictoDemo, type PictoName } from "@/components/pictos";
import type { ChoreEntry, PhaseGroupKey } from "@/lib/chore-state";
import type { DayPhase } from "@/lib/time-of-day";
import { cn } from "@/lib/utils";
import { taskPictoOf } from "./task-picto";
import type { Chore } from "./types";
import { useWidth } from "./use-width";

export const TOD_PICTO: Record<PhaseGroupKey, PictoName> = {
  MORNING: "tod-morning",
  DAY: "tod-day",
  EVENING: "tod-evening",
  ANYTIME: "tod-anytime",
};

/** The picture for "now": the group pictos plus the night, which has no chores group of its own. */
export const PHASE_PICTO: Record<DayPhase, PictoName> = {
  MORNING: "tod-morning",
  DAY: "tod-day",
  EVENING: "tod-evening",
  NIGHT: "tod-night",
};

const MAX_CHIPS = 5;
const MAX_SEGMENTS = 12;
const BAR_PX = 56;
const SEGMENT_GAP_PX = 2;
const OUTLINE_MIN_PX = 6;

type ProgressBarProps = { done: number; total: number; color: string };

/**
 * One segment per chore, at most 12 in a fixed 56 px, so the group label always keeps
 * its room. Done = solid in the person's colour, open = an empty outline; segments
 * too thin for an outline (more than 8 chores) are tall when done and short when open.
 * The difference is a shape, not only a colour. The number lives in the aria-label.
 */
function ProgressBar({ done, total, color }: ProgressBarProps) {
  const tone = toneOf(color);
  const count = Math.min(total, MAX_SEGMENTS);
  const filled = total > MAX_SEGMENTS ? Math.round((done / total) * MAX_SEGMENTS) : done;
  const width = Math.min(14, Math.floor((BAR_PX - (count - 1) * SEGMENT_GAP_PX) / count));

  const outlined = width >= OUTLINE_MIN_PX;

  return (
    <span aria-hidden className="flex h-3.5 items-center" style={{ gap: SEGMENT_GAP_PX }}>
      {Array.from({ length: count }, (_, i) =>
        i < filled ? (
          <span key={i} className={cn("h-3.5 rounded-[4px]", tone.bg)} style={{ width }} />
        ) : outlined ? (
          <span key={i} className="h-3.5 rounded-[4px] border-2 border-muted/70" style={{ width }} />
        ) : (
          <span key={i} className="h-1.5 rounded-[2px] bg-muted/50" style={{ width }} />
        ),
      )}
    </span>
  );
}

type HeaderProps = {
  group: PhaseGroupKey;
  done: number;
  total: number;
  color: string;
  /** The phase that is running right now. */
  current: boolean;
  onToggle: () => void;
};

export function TimeOfDayHeader({ group, done, total, color, current, onToggle }: HeaderProps) {
  const tPicto = useTranslations("pictos");
  const t = useTranslations("chores");
  const { play, demoProps } = usePictoDemo();
  const label = tPicto(TOD_PICTO[group]);
  const complete = total > 0 && done === total;

  useEffect(() => {
    if (current) play();
  }, [current, play]);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded
      aria-label={t("group.collapse", { name: label })}
      className="flex h-12 w-full items-center gap-2 rounded-2xl px-1 text-left focus-ring-kid"
    >
      <span {...demoProps} className="flex shrink-0">
        <Picto name={TOD_PICTO[group]} size={40} />
      </span>
      <span className="kid-title min-w-0 flex-1 truncate text-ink">{label}</span>
      <span
        role="img"
        className={cn(
          "inline-flex h-8 min-w-10 shrink-0 items-center justify-center rounded-full px-2",
          current ? "bg-surface" : "bg-surface/70",
        )}
        aria-label={t("group.progress", { done, total })}
      >
        {complete ? <Picto name="celebrate" size={24} /> : <ProgressBar done={done} total={total} color={color} />}
      </span>
    </button>
  );
}

type ChipsProps = {
  group: PhaseGroupKey;
  entries: ChoreEntry<Chore>[];
  done: number;
  onToggle: () => void;
};

const CHIP_PX = 40;
const CHIP_GAP_PX = 6;
/** Row padding, group picto, gaps and the chevron around the chips. */
const CHIP_ROW_CHROME_PX = 96;

/** Collapsed group: mini pictos with an open/done mark, one tap opens it. */
export function TimeOfDayChips({ group, entries, done, onToggle }: ChipsProps) {
  const tPicto = useTranslations("pictos");
  const t = useTranslations("chores");
  const [rowRef, width] = useWidth<HTMLButtonElement>();
  const label = tPicto(TOD_PICTO[group]);

  // As many chips as the row holds; the rest becomes "+N" instead of spilling out.
  const room = width === null ? MAX_CHIPS : Math.max(1, Math.floor((width - CHIP_ROW_CHROME_PX + CHIP_GAP_PX) / (CHIP_PX + CHIP_GAP_PX)));
  const fits = entries.length <= Math.min(room, MAX_CHIPS);
  const shownCount = fits ? entries.length : Math.max(1, Math.min(room, MAX_CHIPS) - 1);
  const shown = entries.slice(0, shownCount);
  const hidden = entries.length - shown.length;

  return (
    <button
      ref={rowRef}
      type="button"
      onClick={onToggle}
      aria-expanded={false}
      aria-label={`${t("group.expand", { name: label })}, ${t("group.progress", { done, total: entries.length })}`}
      className="flex h-14 w-full min-w-0 items-center gap-2 overflow-hidden rounded-2xl bg-surface/60 px-2 text-left focus-ring-kid"
    >
      <Picto name={TOD_PICTO[group]} size={36} />
      <span aria-hidden className="flex min-w-0 flex-1 items-center gap-1.5">
        {shown.map(({ chore, status }) => {
          const picto = taskPictoOf(chore.icon, chore.title);
          return (
            <span
              key={chore.id}
              className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-surface"
            >
              {picto ? <Picto name={picto} size={30} /> : <Picto name="star" size={30} />}
              <span
                className={cn(
                  "absolute -bottom-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full border-2",
                  status === "done"
                    ? "border-success bg-success text-surface"
                    : "border-muted bg-surface",
                )}
              >
                {status === "done" && <Check className="size-2.5" strokeWidth={5} />}
              </span>
            </span>
          );
        })}
        {hidden > 0 && <span className="kid-label tabular shrink-0 text-muted">+{hidden}</span>}
      </span>
      <ChevronDown className="size-5 shrink-0 text-muted" strokeWidth={2.5} aria-hidden />
    </button>
  );
}
