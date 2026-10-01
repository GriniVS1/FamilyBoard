import type { ChoreTimeOfDay } from "./enums";
import { earlierPhases, phaseOf, PHASE_ORDER, type DayPhase } from "./time-of-day.ts";

// Pure on purpose: `node --test` loads this file directly, so value imports
// stay relative with an explicit `.ts` extension and everything else is type-only.

export type ChoreLike = {
  id: string;
  memberId: string | null;
  timeOfDay: ChoreTimeOfDay | null;
  points: number;
};

export type CompletionLike = {
  id: string;
  choreId: string;
  memberId: string;
};

export type ChoreStatus = "open" | "next" | "done";

/** `ANYTIME` is the group for chores without a `timeOfDay`. */
export type PhaseGroupKey = ChoreTimeOfDay | "ANYTIME";

export const GROUP_ORDER: readonly PhaseGroupKey[] = [...PHASE_ORDER, "ANYTIME"];

/**
 * `empty`: the person has no chores at all (never celebrate that).
 * `allDone`: chores exist and every one is done today.
 * `night`: nothing is offered between 00:00 and 04:59.
 * `pause`: open chores exist, but only for phases that have not started yet.
 */
export type ColumnState = "empty" | "allDone" | "pause" | "night" | "active";

export type ChoreEntry<T extends ChoreLike> = { chore: T; status: ChoreStatus };

export type ChoreGroup<T extends ChoreLike> = {
  key: PhaseGroupKey;
  entries: ChoreEntry<T>[];
  done: number;
  total: number;
};

export type ColumnSummary<T extends ChoreLike> = {
  state: ColumnState;
  next: T | null;
  /** Earliest phase that still has open chores; drives the dimmed picto of `pause`. */
  upcomingPhase: ChoreTimeOfDay | null;
  done: number;
  total: number;
  open: number;
};

export function groupKeyOf(chore: ChoreLike): PhaseGroupKey {
  return chore.timeOfDay ?? "ANYTIME";
}

export function doneChoreIds(completions: readonly CompletionLike[]): Set<string> {
  return new Set(completions.map((c) => c.choreId));
}

export function isChoreDone(choreId: string, completions: readonly CompletionLike[]): boolean {
  return completions.some((c) => c.choreId === choreId);
}

/** Who did a "for everyone" chore today (the latest completion wins). */
export function completionFor(
  choreId: string,
  completions: readonly CompletionLike[],
): CompletionLike | null {
  let found: CompletionLike | null = null;
  for (const c of completions) if (c.choreId === choreId) found = c;
  return found;
}

export function choresOf<T extends ChoreLike>(memberId: string | null, chores: readonly T[]): T[] {
  return chores.filter((c) => c.memberId === memberId);
}

/**
 * The one chore a person should do now (UX 2.1):
 * current phase first, then "anytime", then catching up on earlier phases
 * (most recent first). Never during the night, never for unassigned chores.
 */
export function nextChoreFor<T extends ChoreLike>(
  memberId: string,
  chores: readonly T[],
  completions: readonly CompletionLike[],
  now: Date,
): T | null {
  const phase = phaseOf(now);
  if (phase === "NIGHT") return null;

  const done = doneChoreIds(completions);
  const open = chores.filter((c) => c.memberId === memberId && !done.has(c.id));

  const inPhase = open.find((c) => c.timeOfDay === phase);
  if (inPhase) return inPhase;

  const anytime = open.find((c) => c.timeOfDay === null);
  if (anytime) return anytime;

  for (const earlier of earlierPhases(phase)) {
    const late = open.find((c) => c.timeOfDay === earlier);
    if (late) return late;
  }
  return null;
}

export function dayProgress<T extends ChoreLike>(
  memberId: string,
  chores: readonly T[],
  completions: readonly CompletionLike[],
): { done: number; total: number } {
  const done = doneChoreIds(completions);
  const own = chores.filter((c) => c.memberId === memberId);
  return { done: own.filter((c) => done.has(c.id)).length, total: own.length };
}

export function columnSummary<T extends ChoreLike>(
  memberId: string,
  chores: readonly T[],
  completions: readonly CompletionLike[],
  now: Date,
): ColumnSummary<T> {
  const { done, total } = dayProgress(memberId, chores, completions);
  const open = total - done;
  const phase = phaseOf(now);

  const doneIds = doneChoreIds(completions);
  const openChores = chores.filter((c) => c.memberId === memberId && !doneIds.has(c.id));
  const upcomingPhase =
    PHASE_ORDER.find((p) => openChores.some((c) => c.timeOfDay === p)) ?? null;

  if (total === 0) return { state: "empty", next: null, upcomingPhase: null, done, total, open };
  if (open === 0) return { state: "allDone", next: null, upcomingPhase: null, done, total, open };
  if (phase === "NIGHT") return { state: "night", next: null, upcomingPhase, done, total, open };

  const next = nextChoreFor(memberId, chores, completions, now);
  if (next) return { state: "active", next, upcomingPhase, done, total, open };

  return { state: "pause", next: null, upcomingPhase, done, total, open };
}

/**
 * Groups in fixed order (morning, day, evening, anytime), empty groups dropped.
 * Inside a group: next first, then open, then done — each in API order.
 */
export function groupByPhase<T extends ChoreLike>(
  chores: readonly T[],
  completions: readonly CompletionLike[],
  nextId: string | null,
): ChoreGroup<T>[] {
  const doneIds = doneChoreIds(completions);
  const groups: ChoreGroup<T>[] = [];

  for (const key of GROUP_ORDER) {
    const inGroup = chores.filter((c) => groupKeyOf(c) === key);
    if (inGroup.length === 0) continue;

    const entries: ChoreEntry<T>[] = inGroup.map((chore) => ({
      chore,
      status: doneIds.has(chore.id) ? "done" : chore.id === nextId ? "next" : "open",
    }));
    const rank: Record<ChoreStatus, number> = { next: 0, open: 1, done: 2 };
    entries.sort((a, b) => rank[a.status] - rank[b.status]);

    groups.push({
      key,
      entries,
      done: entries.filter((e) => e.status === "done").length,
      total: entries.length,
    });
  }
  return groups;
}

/**
 * Open by default: the running phase, "anytime", and whichever group holds the
 * "next" chore — otherwise a catch-up chore would hide in a collapsed group.
 */
export function expandedGroupKeys(
  phase: DayPhase,
  next: ChoreLike | null,
): Set<PhaseGroupKey> {
  const keys = new Set<PhaseGroupKey>(["ANYTIME"]);
  if (phase !== "NIGHT") keys.add(phase);
  if (next) keys.add(groupKeyOf(next));
  return keys;
}
