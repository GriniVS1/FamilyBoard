---
title: Scroll in one column (or an automatic scroll after a re-sort) swallows taps in all other columns for 300 ms
severity: P3
area: frontend
owner: frontend-developer
status: verified
slice: kid-friendly-ui
created: 2026-09-30T23:39:47Z
---

## Reproduction

1. Wall 1280x800, `/chores`, four columns. Scroll Mama's column so a card (e.g. "TEST y1") is fully visible, wait 1 s.
2. In Leo's column change the scroll position by a few pixels (`scroller.scrollTop += 3`, i.e. what a finger or scroll anchoring does).
3. Tap Mama's card 100 ms, 200 ms or 450 ms later (real CDP mouse events). Count `ChoreCompletion` rows for the card.

## Expected

A scroll only invalidates taps in the column that scrolled. A sibling tapping their own column must not lose a tap because another column moved (same scoping as the layout-shift guard that was made per column in round 4).

## Actual

Tap 100 ms after the scroll: swallowed (0 rows). 200 ms: swallowed. 450 ms: works. No request is sent and there is no feedback. Cause: the board root has one `onScrollCapture` that writes `lastScrollAt`, and `handlePress` drops every card tap within `SCROLL_TAP_GUARD_MS` (300 ms) of it, regardless of which column scrolled.

It also shows up without any finger: in one of the round-4 runs of the "re-sort in another column" scenario the page logged `8053 ms mut (Leo column)` and `8054 ms scroll DIV…` (the column's scroller adjusted its position when the cards were re-sorted), and the Mama tap 115 ms later was swallowed. That scenario passed in 28 of 30 runs, the 2 failures fell into a window in which a reviewer was also deleting completions of the Leo test chore, so I cannot attribute them with certainty. The deterministic repro above does not depend on that.

## Evidence

```text
scroll in Leo's column, Mama tap 100 ms later -> Mama y1 completions: 0 (swallowed)
scroll in Leo's column, Mama tap 200 ms later -> Mama y1 completions: 0 (swallowed)
scroll in Leo's column, Mama tap 450 ms later -> Mama y1 completions: 1

src/components/chores/chores-view.tsx:242   if (now - lastScrollAt.current < SCROLL_TAP_GUARD_MS) return;
src/components/chores/chores-view.tsx:462   onScrollCapture={() => { lastScrollAt.current = Date.now(); }}
```

## Notes

Fix: keep `lastScrollAt` per column (e.g. `Map<columnKey, number>`, key from `event.target.closest("[data-member-column]")`) and check the tapped card's column in `handlePress`. Scrolls outside any column (page, dialogs) can keep the global behaviour. Low impact (needs two people or an automatic scroll), hence P3.

## Fix

The scroll guard is per column. The board's `onScrollCapture` now stores the scroll time under the column it came from (`closest("[data-member-column]")`, or `page` for anything else), and `handlePress` asks the new pure helper `scrollTapAllowedIn(scrolls, columnKey, now)` (`src/lib/tap-guards.ts`, 4 unit tests): only the scrolled column drops taps for 300 ms, a page scroll still counts for all.

Re-run with real touches (`scratchpad/fe-tasks/r5-scroll.mjs`): scroll in Leo's column, Mama tap 100 / 200 / 450 ms later -> Mama completions 1 / 1 / 1 (before: 0 / 0 / 1). Control: scroll in Mia's column, tap in Mia's column after 100 ms -> still dropped (0).

## Verification

Final check, 2026-10-01 ~02:30 CEST, real CDP mouse events, wall 1280x800, a real scroll event confirmed in the other column (`scroll events: ["vanl:5"]`, Leo's column scrollTop 0 -> 5):

- Scroll in Leo's column, tap Mama's card 100 ms later: completes (2/2); 200 ms: completes; 450 ms: completes. Before the fix: 100/200 ms swallowed.
- Control: scroll in Mama's own column (scrollTop 243 -> 238, event `278n:238`), tap 100 ms later: swallowed (own-column guard intact); 450 ms later: works.
