"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Plus, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toneOf } from "@/components/kids/tone";
import { useIsWall } from "@/components/kids/use-is-wall";
import { Picto, type PictoName } from "@/components/pictos";
import { MemberAvatar } from "@/components/shared/member-avatar";
import {
  columnSummary,
  completionFor,
  dayProgress,
  expandedGroupKeys,
  groupByPhase,
  type ChoreStatus,
  type CompletionLike,
  type PhaseGroupKey,
} from "@/lib/chore-state";
import { phaseOf } from "@/lib/time-of-day";
import { cn } from "@/lib/utils";
import { DoneStrip } from "./done-strip";
import { TaskCard, type TaskCardSize } from "./task-card";
import { TimeOfDayChips, TimeOfDayHeader, TOD_PICTO } from "./time-of-day-header";
import type { UndoWindow } from "./use-chores";
import { useHeldLayout } from "./use-held-layout";
import type { Chore, ChoreCompletionToday, ChoreMember, WeeklyTotals } from "./types";

/**
 * column: wall/tablet column with its own scroll. stack: same content flowing
 * with the page (phone). focus: one person, big head, two-card grid.
 * strip: the compact "for everyone" block under a focused person.
 */
export type ColumnLayout = "column" | "stack" | "focus" | "strip";

type MemberColumnProps = {
  layout: ColumnLayout;
  /** Omit for the neutral "for everyone" column. */
  member?: ChoreMember;
  members: readonly ChoreMember[];
  chores: readonly Chore[];
  completions: readonly ChoreCompletionToday[];
  now: Date;
  /** Stars collected since the last reset; what the pill counts. */
  balance: number;
  weeklyByChore: Record<string, WeeklyTotals>;
  failed: Record<string, unknown>;
  pending: ReadonlySet<string>;
  undoWindows: Record<string, UndoWindow>;
  /** Bumps when stars land so the counter can pulse. */
  pulseKey: number;
  parentActive: boolean;
  onPress: (chore: Chore, card: HTMLElement) => void;
  onEdit: (chore: Chore) => void;
  onAdd: (memberId: string | null) => void;
  onFocus?: (memberId: string) => void;
  /** Cards of this column just moved (release of a held layout, or a group opened/closed). */
  onLayoutShift: (columnKey: string) => void;
};

const NEUTRAL_TONE_COLOR = "sand";

/** From this many finished chores a group folds them into one row of mini pictures. */
const FOLD_DONE_FROM = 2;

/** What decides where cards sit; held back while a child is still tapping (see useHeldLayout). */
type LayoutSource = {
  chores: readonly Chore[];
  doneIds: ReadonlySet<string>;
  now: Date;
};

export function MemberColumn({
  layout,
  member,
  members,
  chores,
  completions,
  now,
  balance,
  weeklyByChore,
  failed,
  pending,
  undoWindows,
  pulseKey,
  parentActive,
  onPress,
  onEdit,
  onAdd,
  onFocus,
  onLayoutShift,
}: MemberColumnProps) {
  const t = useTranslations("chores");
  const [overrides, setOverrides] = useState<Partial<Record<PhaseGroupKey, boolean>>>({});
  const touchedAt = useRef(0);

  const anyone = !member;
  const columnKey = member?.id ?? "anyone";
  const tone = toneOf(member?.color ?? NEUTRAL_TONE_COLOR);
  const cardSize: TaskCardSize = layout === "focus" ? "focus" : "column";
  const compact = layout === "strip";

  const liveById = useMemo(() => new Map(chores.map((c) => [c.id, c])), [chores]);
  const doneIds = useMemo(() => new Set(completions.map((c) => c.choreId)), [completions]);
  const windowOpen = chores.some((c) => c.id in undoWindows);

  const liveSource = useMemo<LayoutSource>(() => ({ chores, doneIds, now }), [chores, doneIds, now]);
  const signature = [
    phaseOf(now),
    chores.map((c) => `${c.id}:${c.timeOfDay ?? "-"}`).join(","),
    chores
      .filter((c) => doneIds.has(c.id))
      .map((c) => c.id)
      .join(","),
  ].join("|");
  const held = useHeldLayout(liveSource, signature, { touchedAt, windowOpen });

  const layoutChores = held.value.chores;
  const layoutDone = held.value.doneIds;
  const layoutNow = held.value.now;
  const layoutCompletions = useMemo<CompletionLike[]>(
    () => [...layoutDone].map((id) => ({ id, choreId: id, memberId: member?.id ?? "" })),
    [layoutDone, member?.id],
  );

  // Structure (order, open groups, panels) comes from the held layout; what a
  // card shows (done, next) and the counts follow the real data at once.
  const layoutSummary = useMemo(
    () => (member ? columnSummary(member.id, layoutChores, layoutCompletions, layoutNow) : null),
    [member, layoutChores, layoutCompletions, layoutNow],
  );
  const liveNextId = useMemo(
    () => (member ? (columnSummary(member.id, chores, completions, now).next?.id ?? null) : null),
    [member, chores, completions, now],
  );
  const statusOf = (chore: Chore): ChoreStatus =>
    doneIds.has(chore.id) ? "done" : chore.id === liveNextId ? "next" : "open";

  const visibleChores = useMemo(
    () => (compact ? layoutChores.filter((c) => !layoutDone.has(c.id)) : layoutChores),
    [compact, layoutChores, layoutDone],
  );
  const groups = useMemo(
    () => groupByPhase(visibleChores, layoutCompletions, layoutSummary?.next?.id ?? null),
    [visibleChores, layoutCompletions, layoutSummary],
  );
  const expandedByDefault = useMemo(
    () => expandedGroupKeys(phaseOf(layoutNow), layoutSummary?.next ?? null),
    [layoutNow, layoutSummary],
  );

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const counts = member ? dayProgress(member.id, chores, completions) : null;
  const progress = counts && counts.total > 0 ? counts : undefined;
  const name = member?.name ?? t("anyone");
  const grid = layout === "focus" || layout === "strip";
  const currentPhase = phaseOf(layoutNow);

  const shiftKey = `${held.signature}#${JSON.stringify(overrides)}`;
  const firstShiftKey = useRef(true);
  useEffect(() => {
    if (firstShiftKey.current) {
      firstShiftKey.current = false;
      return;
    }
    onLayoutShift(columnKey);
  }, [shiftKey, onLayoutShift, columnKey]);

  function toggleGroup(key: PhaseGroupKey, expanded: boolean) {
    setOverrides((o) => ({ ...o, [key]: !expanded }));
  }

  if (compact && visibleChores.length === 0) return null;

  return (
    <section
      aria-label={name}
      data-member-column={member?.id ?? "anyone"}
      onPointerDownCapture={() => {
        touchedAt.current = Date.now();
      }}
      onScrollCapture={() => {
        touchedAt.current = Date.now();
      }}
      className={cn(
        "flex min-w-0 flex-col rounded-4xl p-2",
        anyone ? "border-2 border-dashed border-border bg-surface/60" : tone.tint,
        layout === "column" &&
          cn(
            "h-full min-h-0 shrink-0 grow snap-start",
            // The extra column is reached by swiping, so it can afford the room long titles need.
            anyone ? "basis-[max(var(--col-w),330px)]" : "basis-[var(--col-w)]",
          ),
      )}
    >
      <ColumnHead
        layout={layout}
        member={member}
        name={name}
        progress={progress}
        openCount={counts && counts.total > 0 ? counts.total - counts.done : undefined}
        balance={balance}
        pulseKey={pulseKey}
        parentActive={parentActive}
        onAdd={() => onAdd(member?.id ?? null)}
        onFocus={member && onFocus ? () => onFocus(member.id) : undefined}
      />

      <div
        className={cn(
          "flex flex-col gap-3",
          layout === "column"
            ? "-mx-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-1 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : "mt-2",
        )}
      >
        {layoutSummary && layoutSummary.state !== "active" && (
          <StatePanel state={layoutSummary.state} upcoming={layoutSummary.upcomingPhase} />
        )}

        {groups.map((group) => {
          const expanded = overrides[group.key] ?? (anyone || expandedByDefault.has(group.key));
          const entries = group.entries.flatMap(({ chore }) => {
            const live = liveById.get(chore.id);
            return live ? [{ chore: live, status: statusOf(live) }] : [];
          });
          const doneCount = entries.filter((e) => e.status === "done").length;
          const folded =
            anyone || compact ? [] : entries.filter((e) => layoutDone.has(e.chore.id));
          const fold = folded.length >= FOLD_DONE_FROM;
          const cards = fold ? entries.filter((e) => !folded.includes(e)) : entries;
          return (
            <div key={group.key} className="flex flex-col gap-2">
              {expanded ? (
                <>
                  <TimeOfDayHeader
                    group={group.key}
                    done={doneCount}
                    total={entries.length}
                    color={member?.color ?? NEUTRAL_TONE_COLOR}
                    current={group.key === currentPhase}
                    onToggle={() => toggleGroup(group.key, true)}
                  />
                  <ul className={cn("grid gap-3", grid ? "grid-cols-1 min-[1180px]:grid-cols-2" : "grid-cols-1")}>
                    {cards.map(({ chore, status }) => {
                      const completion = anyone ? completionFor(chore.id, completions) : null;
                      const stamp = completion ? (memberById.get(completion.memberId) ?? null) : null;
                      return (
                        <TaskCard
                          key={chore.id}
                          chore={chore}
                          status={status}
                          color={stamp?.color ?? member?.color ?? NEUTRAL_TONE_COLOR}
                          size={compact ? "column" : cardSize}
                          failed={chore.id in failed}
                          busy={pending.has(chore.id)}
                          stamp={stamp}
                          weeklyCompletions={
                            parentActive ? (weeklyByChore[chore.id]?.completions ?? 0) : null
                          }
                          onPress={onPress}
                          onEdit={parentActive ? onEdit : undefined}
                        />
                      );
                    })}
                  </ul>
                  {fold && (
                    <DoneStrip
                      chores={folded.map((e) => e.chore)}
                      color={member?.color ?? NEUTRAL_TONE_COLOR}
                      onPress={onPress}
                    />
                  )}
                </>
              ) : (
                <TimeOfDayChips
                  group={group.key}
                  entries={entries}
                  done={doneCount}
                  onToggle={() => toggleGroup(group.key, false)}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

type ColumnHeadProps = {
  layout: ColumnLayout;
  member: ChoreMember | undefined;
  name: string;
  progress: { done: number; total: number } | undefined;
  openCount: number | undefined;
  balance: number;
  pulseKey: number;
  parentActive: boolean;
  onAdd: () => void;
  onFocus: (() => void) | undefined;
};

function ColumnHead({
  layout,
  member,
  name,
  progress,
  openCount,
  balance,
  pulseKey,
  parentActive,
  onAdd,
  onFocus,
}: ColumnHeadProps) {
  const t = useTranslations("chores");
  const reduced = useReducedMotion();
  const tone = toneOf(member?.color ?? NEUTRAL_TONE_COLOR);
  const wall = useIsWall();
  const focus = layout === "focus";
  const compact = layout === "strip";
  // A phone has no room for the big focus head above the first card.
  const bigHead = focus && wall;
  // Wall columns keep their head slim: the avatar bar above already shows the big faces,
  // and every pixel saved here is room for the next card.
  const slim = layout === "column";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3",
        compact || slim ? "h-16" : bigHead ? "h-28" : focus ? "h-20" : "h-24",
      )}
    >
      {member ? (
        <button
          type="button"
          onClick={onFocus}
          disabled={!onFocus}
          aria-label={t("focusOn", { name })}
          className="shrink-0 rounded-full focus-ring-kid disabled:cursor-default"
        >
          <MemberAvatar
            size={bigHead ? "xl" : slim ? "md" : "lg"}
            name={name}
            color={member.color}
            emoji={member.emoji}
            progress={progress}
            openCount={openCount}
            onTint
          />
        </button>
      ) : (
        <span
          aria-hidden
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-muted bg-surface text-ink",
            compact || slim ? "size-14" : "size-[72px]",
          )}
        >
          <Users className={compact || slim ? "size-6" : "size-9"} strokeWidth={2} />
        </span>
      )}

      <div className={cn("flex min-w-0 flex-1 flex-col items-start", slim ? "gap-0.5" : "gap-1")}>
        <span
          className={cn(
            "break-words [hyphens:auto]",
            slim ? "kid-title line-clamp-1" : "line-clamp-2",
            bigHead ? "kid-heading" : slim ? "" : "kid-title-lg",
            member ? tone.ink : "text-ink",
          )}
        >
          {name}
        </span>
        {member && (
          <motion.span
            key={pulseKey}
            data-star-target={member.id}
            role="img"
            aria-label={t("starsBalance", { count: balance })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full bg-surface px-3",
              slim ? "h-8" : "h-10",
            )}
            animate={pulseKey > 0 && !reduced ? { scale: [1, 1.3, 1] } : undefined}
            transition={{ duration: 0.42, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <Picto name="star" size={slim ? 20 : 24} />
            <span aria-hidden className="kid-number text-ink">{balance}</span>
          </motion.span>
        )}
      </div>

      {parentActive && (
        <button
          type="button"
          onClick={onAdd}
          aria-label={member ? t("addChoreFor", { name }) : t("addUnassigned")}
          className={cn(
            "inline-flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-border",
            "bg-surface text-ink shadow-pop focus-ring-kid",
            "transition-transform duration-100 ease-snappy active:translate-y-0.5 active:shadow-press",
          )}
        >
          <Plus className="size-7" strokeWidth={2.75} />
        </button>
      )}
    </div>
  );
}

type StatePanelProps = {
  state: "empty" | "allDone" | "pause" | "night";
  upcoming: "MORNING" | "DAY" | "EVENING" | null;
};

function StatePanel({ state, upcoming }: StatePanelProps) {
  const t = useTranslations("chores");

  const config: Record<StatePanelProps["state"], { picto: PictoName; label: string; dim: boolean }> = {
    empty: { picto: "relax", label: t("column.empty"), dim: false },
    allDone: { picto: "celebrate", label: t("state.allDone"), dim: false },
    night: { picto: "tod-night", label: t("state.night"), dim: false },
    pause: { picto: upcoming ? TOD_PICTO[upcoming] : "tod-anytime", label: t("state.pause"), dim: true },
  };
  const { picto, label, dim } = config[state];

  return (
    <div className="flex min-h-[88px] items-center gap-3 rounded-3xl bg-surface/70 p-3">
      <span className="relative flex shrink-0">
        <Picto name={picto} size={72} className={cn(dim && "opacity-55")} />
        {state === "pause" && (
          <span
            aria-hidden
            className="absolute -bottom-1 -right-2 flex size-9 items-center justify-center rounded-full bg-surface shadow-pop"
          >
            <Picto name="pause" size={28} />
          </span>
        )}
      </span>
      <span className="kid-title min-w-0 flex-1 text-ink">{label}</span>
    </div>
  );
}
