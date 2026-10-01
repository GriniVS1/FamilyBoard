import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COLUMN_TAP_LOCK_MS,
  LAYOUT_QUIET_MS,
  LAYOUT_TAP_GUARD_MS,
  PAGE_SCROLL_KEY,
  SCROLL_TAP_GUARD_MS,
  columnTapAllowed,
  layoutTapAllowed,
  layoutTapAllowedIn,
  scrollTapAllowedIn,
  shouldHoldLayout,
} from "./tap-guards.ts";

const last = { columnKey: "mia", choreId: "toys", at: 10_000 };

describe("columnTapAllowed", () => {
  it("blocks another card of the same column within the lock", () => {
    assert.equal(columnTapAllowed(last, "mia", "pyjama", 10_300), false);
    assert.equal(columnTapAllowed(last, "mia", "pyjama", 10_000 + COLUMN_TAP_LOCK_MS - 1), false);
  });

  it("allows it once the lock has passed", () => {
    assert.equal(columnTapAllowed(last, "mia", "pyjama", 10_000 + COLUMN_TAP_LOCK_MS), true);
  });

  it("never blocks the card that was just ticked (its own reveal rules apply)", () => {
    assert.equal(columnTapAllowed(last, "mia", "toys", 10_100), true);
  });

  it("never blocks other columns", () => {
    assert.equal(columnTapAllowed(last, "leo", "bag", 10_100), true);
  });

  it("allows everything before the first tick", () => {
    assert.equal(columnTapAllowed(null, "mia", "toys", 1), true);
  });
});

describe("layoutTapAllowed", () => {
  it("drops a tap just before the guard ends", () => {
    assert.equal(layoutTapAllowed(5_000, 5_000 + LAYOUT_TAP_GUARD_MS - 1), false);
  });

  it("covers at least the 400 ms the cards need to settle", () => {
    assert.equal(layoutTapAllowed(5_000, 5_399), false);
    assert.ok(LAYOUT_TAP_GUARD_MS >= 400);
  });

  it("accepts it once the guard has passed and when nothing ever moved", () => {
    assert.equal(layoutTapAllowed(5_000, 5_000 + LAYOUT_TAP_GUARD_MS), true);
    assert.equal(layoutTapAllowed(null, 5_000), true);
  });
});

describe("layoutTapAllowedIn", () => {
  const shifts = new Map([["leo", 5_000]]);

  it("drops a tap in the column that just moved", () => {
    assert.equal(layoutTapAllowedIn(shifts, "leo", 5_100), false);
  });

  it("does not let Leo's reorder swallow a tap in Mama's column", () => {
    assert.equal(layoutTapAllowedIn(shifts, "mama", 5_100), true);
    assert.equal(layoutTapAllowedIn(new Map(), "mama", 5_100), true);
  });

  it("accepts the tap in Leo's column after the guard", () => {
    assert.equal(layoutTapAllowedIn(shifts, "leo", 5_000 + LAYOUT_TAP_GUARD_MS), true);
  });
});

describe("scrollTapAllowedIn", () => {
  it("drops a tap in the column that just scrolled", () => {
    const scrolls = new Map([["leo", 5_000]]);
    assert.equal(scrollTapAllowedIn(scrolls, "leo", 5_100), false);
    assert.equal(scrollTapAllowedIn(scrolls, "leo", 5_000 + SCROLL_TAP_GUARD_MS), true);
  });

  it("does not let Leo's scroll swallow a tap in Mama's column", () => {
    const scrolls = new Map([["leo", 5_000]]);
    assert.equal(scrollTapAllowedIn(scrolls, "mama", 5_100), true);
    assert.equal(scrollTapAllowedIn(scrolls, "mama", 5_200), true);
  });

  it("a page scroll still counts for every column", () => {
    const scrolls = new Map([[PAGE_SCROLL_KEY, 5_000]]);
    assert.equal(scrollTapAllowedIn(scrolls, "mama", 5_100), false);
    assert.equal(scrollTapAllowedIn(scrolls, "leo", 5_100), false);
    assert.equal(scrollTapAllowedIn(scrolls, "mama", 5_000 + SCROLL_TAP_GUARD_MS), true);
  });

  it("allows everything when nothing scrolled", () => {
    assert.equal(scrollTapAllowedIn(new Map(), "mama", 1), true);
  });
});

describe("shouldHoldLayout", () => {
  it("holds right after a touch", () => {
    assert.equal(shouldHoldLayout({ now: 10_500, lastTouchAt: 10_000, windowOpen: false }), true);
  });

  it("holds while a ↶ window is open even if nobody touched for a long time", () => {
    assert.equal(shouldHoldLayout({ now: 60_000, lastTouchAt: 10_000, windowOpen: true }), true);
  });

  it("releases only after the quiet time and with the window closed", () => {
    assert.equal(
      shouldHoldLayout({ now: 10_000 + LAYOUT_QUIET_MS - 1, lastTouchAt: 10_000, windowOpen: false }),
      true,
    );
    assert.equal(
      shouldHoldLayout({ now: 10_000 + LAYOUT_QUIET_MS, lastTouchAt: 10_000, windowOpen: false }),
      false,
    );
  });
});
