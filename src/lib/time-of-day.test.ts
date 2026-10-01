import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { earlierPhases, laterPhases, phaseOf, PHASE_ORDER } from "./time-of-day.ts";

function at(hour: number, minute: number): Date {
  return new Date(2026, 8, 30, hour, minute);
}

describe("phaseOf", () => {
  const cases: Array<[string, Date, ReturnType<typeof phaseOf>]> = [
    ["00:00", at(0, 0), "NIGHT"],
    ["04:59", at(4, 59), "NIGHT"],
    ["05:00", at(5, 0), "MORNING"],
    ["10:59", at(10, 59), "MORNING"],
    ["11:00", at(11, 0), "DAY"],
    ["16:59", at(16, 59), "DAY"],
    ["17:00", at(17, 0), "EVENING"],
    ["23:59", at(23, 59), "EVENING"],
  ];

  for (const [label, date, expected] of cases) {
    it(`${label} is ${expected}`, () => {
      assert.equal(phaseOf(date), expected);
    });
  }
});

describe("earlierPhases / laterPhases", () => {
  it("lists earlier phases most recent first", () => {
    assert.deepEqual(earlierPhases("EVENING"), ["DAY", "MORNING"]);
    assert.deepEqual(earlierPhases("DAY"), ["MORNING"]);
    assert.deepEqual(earlierPhases("MORNING"), []);
    assert.deepEqual(earlierPhases("NIGHT"), []);
  });

  it("lists later phases in day order", () => {
    assert.deepEqual(laterPhases("MORNING"), ["DAY", "EVENING"]);
    assert.deepEqual(laterPhases("EVENING"), []);
    assert.deepEqual(laterPhases("NIGHT"), [...PHASE_ORDER]);
  });
});
