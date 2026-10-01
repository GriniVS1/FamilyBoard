import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeBalance, runExclusive } from "./points.ts";

const T0 = new Date("2026-10-01T08:00:00.000Z");

function at(offsetMs: number): Date {
  return new Date(T0.getTime() + offsetMs);
}

describe("computeBalance", () => {
  it("sums every completion when the member was never reset", () => {
    const rows = [
      { points: 3, completedAt: at(-86_400_000) },
      { points: 2, completedAt: at(0) },
      { points: 5, completedAt: at(60_000) },
    ];
    assert.equal(computeBalance(rows, null), 10);
  });

  it("is zero without completions", () => {
    assert.equal(computeBalance([], null), 0);
    assert.equal(computeBalance([], T0), 0);
  });

  it("ignores completions before the reset", () => {
    const rows = [
      { points: 4, completedAt: at(-1) },
      { points: 7, completedAt: at(-3_600_000) },
    ];
    assert.equal(computeBalance(rows, T0), 0);
  });

  it("counts completions after the reset", () => {
    const rows = [
      { points: 4, completedAt: at(-1) },
      { points: 2, completedAt: at(1) },
      { points: 3, completedAt: at(5_000) },
    ];
    assert.equal(computeBalance(rows, T0), 5);
  });

  it("excludes a completion exactly at the reset instant", () => {
    const rows = [
      { points: 6, completedAt: at(0) },
      { points: 1, completedAt: at(1) },
    ];
    assert.equal(computeBalance(rows, T0), 1);
  });

  it("compares by instant, not by Date identity", () => {
    const rows = [{ points: 9, completedAt: new Date(T0.getTime()) }];
    assert.equal(computeBalance(rows, new Date(T0.getTime())), 0);
  });

  it("does not mutate its input", () => {
    const rows = [{ points: 2, completedAt: at(10) }];
    const copy = rows.map((r) => ({ ...r }));
    computeBalance(rows, T0);
    assert.deepEqual(rows, copy);
  });
});

describe("runExclusive", () => {
  it("runs tasks one after another in submission order", async () => {
    const log: string[] = [];
    const slow = runExclusive(async () => {
      log.push("a:start");
      await new Promise((resolve) => setTimeout(resolve, 20));
      log.push("a:end");
      return "a";
    });
    const fast = runExclusive(async () => {
      log.push("b:start");
      log.push("b:end");
      return "b";
    });
    assert.deepEqual(await Promise.all([slow, fast]), ["a", "b"]);
    assert.deepEqual(log, ["a:start", "a:end", "b:start", "b:end"]);
  });

  it("keeps the queue alive after a failing task", async () => {
    await assert.rejects(
      runExclusive(async () => {
        throw new Error("boom");
      }),
      /boom/,
    );
    assert.equal(await runExclusive(async () => 42), 42);
  });
});
