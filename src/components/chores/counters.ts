import type { ChoresPayload } from "./types";

// Pure on purpose: `node --test` loads this file directly, so it only imports types.

export type CompletionDelta = {
  memberId: string;
  choreId: string;
  points: number;
  completedAt: string;
  sign: 1 | -1;
};

/**
 * What ticking (+1) or un-ticking (-1) a chore does to the cached payload: the
 * week counters, and the balance unless a reset already took the tick's points
 * out of it.
 */
export function adjustCounters(
  payload: ChoresPayload,
  { memberId, choreId, points, completedAt, sign }: CompletionDelta,
): ChoresPayload {
  const bump = (entry: { points: number; completions: number } | undefined) => ({
    points: Math.max(0, (entry?.points ?? 0) + sign * points),
    completions: Math.max(0, (entry?.completions ?? 0) + sign),
  });
  const before = payload.balanceByMember[memberId];
  // A tick from before the last reset is not part of the balance, so undoing it must not touch it either.
  const counts = !before?.since || Date.parse(completedAt) > Date.parse(before.since);
  return {
    ...payload,
    weeklyByMember: { ...payload.weeklyByMember, [memberId]: bump(payload.weeklyByMember[memberId]) },
    weeklyByChore: { ...payload.weeklyByChore, [choreId]: bump(payload.weeklyByChore[choreId]) },
    balanceByMember: counts
      ? {
          ...payload.balanceByMember,
          [memberId]: {
            balance: Math.max(0, (before?.balance ?? 0) + sign * points),
            since: before?.since ?? null,
          },
        }
      : payload.balanceByMember,
  };
}
