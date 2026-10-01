import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isUndoArmed, UNDO_ARM_MS } from "./undo-guard.ts";

describe("isUndoArmed", () => {
  it("ignores a second tap 300 ms after the button appeared", () => {
    assert.equal(isUndoArmed(1_000, 1_300), false);
  });

  it("ignores a tap one millisecond before the guard ends", () => {
    assert.equal(isUndoArmed(1_000, 1_000 + UNDO_ARM_MS - 1), false);
  });

  it("accepts a tap once the guard has passed", () => {
    assert.equal(isUndoArmed(1_000, 1_000 + UNDO_ARM_MS), true);
    assert.equal(isUndoArmed(1_000, 9_000), true);
  });

  it("honours a custom guard length", () => {
    assert.equal(isUndoArmed(0, 99, 100), false);
    assert.equal(isUndoArmed(0, 100, 100), true);
  });
});
