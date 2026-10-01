import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  columnSummary,
  completionFor,
  dayProgress,
  expandedGroupKeys,
  groupByPhase,
  nextChoreFor,
  type ChoreLike,
  type CompletionLike,
} from "./chore-state.ts";

type TestChore = ChoreLike & { title: string };

const MIA = "mia";
const LEO = "leo";

let seq = 0;
function chore(
  title: string,
  timeOfDay: ChoreLike["timeOfDay"],
  memberId: string | null = MIA,
): TestChore {
  seq += 1;
  return { id: `c${seq}`, title, memberId, timeOfDay, points: 1 };
}

function done(c: ChoreLike, memberId: string = MIA): CompletionLike {
  return { id: `done-${c.id}`, choreId: c.id, memberId };
}

function at(hour: number, minute = 0): Date {
  return new Date(2026, 8, 30, hour, minute);
}

describe("nextChoreFor", () => {
  it("morning picks the first open morning chore", () => {
    const day = chore("day", "DAY");
    const morning = chore("morning", "MORNING");
    const next = nextChoreFor(MIA, [day, morning], [], at(7));
    assert.equal(next?.title, "morning");
  });

  it("day prefers a day chore over an open morning one", () => {
    const morning = chore("morning", "MORNING");
    const day = chore("day", "DAY");
    assert.equal(nextChoreFor(MIA, [morning, day], [], at(13))?.title, "day");
  });

  it("evening picks an evening chore", () => {
    const day = chore("day", "DAY");
    const evening = chore("evening", "EVENING");
    assert.equal(nextChoreFor(MIA, [day, evening], [], at(19))?.title, "evening");
  });

  it("night marks nothing as next", () => {
    const evening = chore("evening", "EVENING");
    const anytime = chore("anytime", null);
    assert.equal(nextChoreFor(MIA, [evening, anytime], [], at(2)), null);
  });

  it("anytime chores fill in when the current phase has nothing open", () => {
    const morning = chore("morning", "MORNING");
    const anytime = chore("water", null);
    const day = chore("day", "DAY");
    const next = nextChoreFor(MIA, [morning, anytime, day], [done(day)], at(13));
    assert.equal(next?.title, "water");
  });

  it("a current-phase chore beats an anytime chore listed before it", () => {
    const anytime = chore("water", null);
    const day = chore("day", "DAY");
    assert.equal(nextChoreFor(MIA, [anytime, day], [], at(12))?.title, "day");
  });

  it("catches up on the most recent earlier phase first", () => {
    const morning = chore("morning", "MORNING");
    const day = chore("day", "DAY");
    const next = nextChoreFor(MIA, [morning, day], [], at(18));
    assert.equal(next?.title, "day");
  });

  it("catches up on morning when that is all that is left in the evening", () => {
    const morning = chore("morning", "MORNING");
    const evening = chore("evening", "EVENING");
    const next = nextChoreFor(MIA, [morning, evening], [done(evening)], at(20));
    assert.equal(next?.title, "morning");
  });

  it("does not pull chores from later phases forward", () => {
    const evening = chore("evening", "EVENING");
    assert.equal(nextChoreFor(MIA, [evening], [], at(8)), null);
  });

  it("skips chores that are already done and moves to the following one", () => {
    const a = chore("a", "MORNING");
    const b = chore("b", "MORNING");
    assert.equal(nextChoreFor(MIA, [a, b], [], at(6))?.title, "a");
    assert.equal(nextChoreFor(MIA, [a, b], [done(a)], at(6))?.title, "b");
    assert.equal(nextChoreFor(MIA, [a, b], [done(a), done(b)], at(6)), null);
  });

  it("never marks unassigned chores and ignores other members' chores", () => {
    const shared = chore("laundry", null, null);
    const leos = chore("leo's", "MORNING", LEO);
    assert.equal(nextChoreFor(MIA, [shared, leos], [], at(7)), null);
    assert.equal(nextChoreFor(LEO, [shared, leos], [], at(7))?.title, "leo's");
  });

  it("treats a completion by someone else as done", () => {
    const a = chore("a", "MORNING");
    const next = nextChoreFor(MIA, [a], [done(a, LEO)], at(7));
    assert.equal(next, null);
  });
});

describe("columnSummary", () => {
  it("reports active with the next chore and counts", () => {
    const a = chore("a", "MORNING");
    const b = chore("b", "DAY");
    const s = columnSummary(MIA, [a, b], [done(a)], at(12));
    assert.equal(s.state, "active");
    assert.equal(s.next?.title, "b");
    assert.deepEqual([s.done, s.total, s.open], [1, 2, 1]);
  });

  it("reports allDone when every chore is done", () => {
    const a = chore("a", "MORNING");
    const s = columnSummary(MIA, [a], [done(a)], at(9));
    assert.equal(s.state, "allDone");
    assert.equal(s.next, null);
  });

  it("reports allDone (not night) when nothing is left after midnight", () => {
    const a = chore("a", "EVENING");
    assert.equal(columnSummary(MIA, [a], [done(a)], at(1)).state, "allDone");
  });

  it("reports pause with the upcoming phase when only later chores are open", () => {
    const evening = chore("evening", "EVENING");
    const s = columnSummary(MIA, [evening], [], at(9));
    assert.equal(s.state, "pause");
    assert.equal(s.upcomingPhase, "EVENING");
  });

  it("reports night with open chores between 00:00 and 04:59", () => {
    const a = chore("a", "MORNING");
    assert.equal(columnSummary(MIA, [a], [], at(4, 59)).state, "night");
    assert.equal(columnSummary(MIA, [a], [], at(5)).state, "active");
  });

  it("reports empty for a person without chores", () => {
    const other = chore("x", "DAY", LEO);
    assert.equal(columnSummary(MIA, [other], [], at(12)).state, "empty");
  });

  it("counts only the person's assigned chores toward the day progress", () => {
    const a = chore("a", "MORNING");
    const b = chore("b", "DAY");
    const shared = chore("shared", null, null);
    const progress = dayProgress(MIA, [a, b, shared], [done(a), done(shared)]);
    assert.deepEqual(progress, { done: 1, total: 2 });
  });
});

describe("groupByPhase", () => {
  it("orders groups morning, day, evening, anytime and drops empty ones", () => {
    const any = chore("any", null);
    const evening = chore("evening", "EVENING");
    const morning = chore("morning", "MORNING");
    const groups = groupByPhase([any, evening, morning], [], null);
    assert.deepEqual(
      groups.map((g) => g.key),
      ["MORNING", "EVENING", "ANYTIME"],
    );
  });

  it("sorts next, open, done inside a group and keeps API order otherwise", () => {
    const a = chore("a", "DAY");
    const b = chore("b", "DAY");
    const c = chore("c", "DAY");
    const d = chore("d", "DAY");
    const [group] = groupByPhase([a, b, c, d], [done(a), done(c)], d.id);
    assert.deepEqual(
      group.entries.map((e) => `${e.chore.title}:${e.status}`),
      ["d:next", "b:open", "a:done", "c:done"],
    );
    assert.deepEqual([group.done, group.total], [2, 4]);
  });

  it("never yields a next entry when no next id is given (unassigned column)", () => {
    const shared = chore("shared", null, null);
    const groups = groupByPhase([shared], [], null);
    assert.equal(groups[0].entries[0].status, "open");
  });
});

describe("expandedGroupKeys", () => {
  it("opens the running phase and anytime", () => {
    assert.deepEqual([...expandedGroupKeys("DAY", null)].sort(), ["ANYTIME", "DAY"]);
  });

  it("also opens the group that holds a catch-up next chore", () => {
    const late = chore("late", "MORNING");
    assert.deepEqual(
      [...expandedGroupKeys("EVENING", late)].sort(),
      ["ANYTIME", "EVENING", "MORNING"],
    );
  });

  it("opens only anytime at night", () => {
    assert.deepEqual([...expandedGroupKeys("NIGHT", null)], ["ANYTIME"]);
  });
});

describe("completionFor", () => {
  it("returns the latest completion for the chore", () => {
    const shared = chore("shared", null, null);
    const first: CompletionLike = { id: "1", choreId: shared.id, memberId: MIA };
    const second: CompletionLike = { id: "2", choreId: shared.id, memberId: LEO };
    assert.equal(completionFor(shared.id, [first, second])?.memberId, LEO);
    assert.equal(completionFor("missing", [first]), null);
  });
});
