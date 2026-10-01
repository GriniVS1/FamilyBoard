import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adjustCounters } from "./counters.ts";
import type { ChoresPayload } from "./types.ts";

function payload(over: Partial<ChoresPayload> = {}): ChoresPayload {
  return {
    chores: [],
    weekStart: "2026-09-28T00:00:00.000Z",
    weekEnd: "2026-10-05T00:00:00.000Z",
    weeklyByMember: { mia: { points: 6, completions: 6 } },
    weeklyByChore: { bed: { points: 2, completions: 2 } },
    completionsToday: [],
    today: { start: "2026-10-01T00:00:00.000Z", end: "2026-10-02T00:00:00.000Z" },
    balanceByMember: { mia: { balance: 10, since: null } },
    ...over,
  };
}

const tick = { memberId: "mia", choreId: "bed", points: 2, completedAt: "2026-10-01T08:00:00.000Z" };

describe("adjustCounters", () => {
  it("adds the points to the balance and the week", () => {
    const next = adjustCounters(payload(), { ...tick, sign: 1 });
    assert.deepEqual(next.balanceByMember.mia, { balance: 12, since: null });
    assert.deepEqual(next.weeklyByMember.mia, { points: 8, completions: 7 });
  });

  it("takes them off again on undo", () => {
    const next = adjustCounters(payload(), { ...tick, sign: -1 });
    assert.equal(next.balanceByMember.mia.balance, 8);
  });

  it("starts a balance for someone who has none yet", () => {
    const next = adjustCounters(payload({ balanceByMember: {} }), { ...tick, sign: 1 });
    assert.deepEqual(next.balanceByMember.mia, { balance: 2, since: null });
  });

  it("counts a tick made after the last reset and keeps the reset time", () => {
    const since = "2026-10-01T07:00:00.000Z";
    const next = adjustCounters(payload({ balanceByMember: { mia: { balance: 0, since } } }), { ...tick, sign: 1 });
    assert.deepEqual(next.balanceByMember.mia, { balance: 2, since });
  });

  it("leaves the balance alone when undoing a tick that came before the reset", () => {
    const since = "2026-10-01T09:00:00.000Z";
    const before = payload({ balanceByMember: { mia: { balance: 0, since } } });
    const next = adjustCounters(before, { ...tick, sign: -1 });
    assert.equal(next.balanceByMember, before.balanceByMember);
    assert.equal(next.weeklyByMember.mia.points, 4);
  });

  it("never goes below zero", () => {
    const next = adjustCounters(payload({ balanceByMember: { mia: { balance: 1, since: null } } }), { ...tick, sign: -1 });
    assert.equal(next.balanceByMember.mia.balance, 0);
  });
});
