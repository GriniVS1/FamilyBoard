---
title: A reorder in one person's column swallows taps in every other column for 600 ms (layout-shift guard is global)
severity: P2
area: frontend
owner: frontend-developer
status: verified
slice: kid-friendly-ui
created: 2026-09-30T22:16:11Z
---

## Reproduction

1. Wall 1280x800, `/chores`. Two columns with open cards that are visible without scrolling, e.g. Leo ("TEST leo1") and Mama ("TEST y1").
2. Tap Leo's card (real CDP mouse events). It completes; Leo's column holds its layout while the ↶ window is open.
3. Wait for Leo's column to re-sort (the card moves to the end of its group). It happens 8.0 s after the tick (window closes, nobody touched Leo's column). Detect it with a MutationObserver on `[data-member-column=<leo>]`.
4. 100 ms after that mutation tap Mama's open card (a different column, nothing moved there).
5. Repeat with the Mama tap 900 ms after Leo's mutation.
6. Variant without any timing trick: complete a chore of another person through the API right before tapping (`POST /api/chores/<miaChore>/complete`), then tap card 1 of Mama, 700 ms later card 2 of Mama. The remote change arrives with the refetch after the first POST and re-sorts Mia's untouched column.

## Expected

A tap is only dropped when cards moved under the finger in the column that was tapped. A reorder of Leo's column must not affect Mama's column (the same holds for a change made on the phone app or by a sibling at the wall). Two deliberate taps 700 ms apart in one column both complete.

## Actual

Step 4: the tap on Mama's card is silently dropped (no request is sent, no feedback). Step 5 works. Variant 6: the second tap at 700 ms is dropped in about 2 of 3 runs, the first card completes. Reason: `handleLayoutShift` writes a single `lastShiftAt` ref in `ChoresBoard`, every `MemberColumn` calls it from its `shiftKey` effect, and `handlePress` checks `layoutTapAllowed(lastShiftAt.current, now)` for all cards regardless of column.

With two kids at the wall this is easy to hit: each tick leads, 8 s later, to a re-sort of that kid's column, and whatever the sibling taps in the 600 ms after it is ignored. It also explains why the "second task 700 ms later" requirement fails intermittently whenever any other column changes (phone app, sibling, poll result) inside that window.

## Evidence

```text
Leo card "TEST leo1, 1 Stern" ticked; Leo layout shift seen after 7974ms; Mama tap at +104ms after it -> Mama y1 completions: 0 (swallowed)
Leo card "TEST leo1, 1 Stern" ticked; Leo layout shift seen after 8016ms; Mama tap at +105ms after it -> Mama y1 completions: 0 (swallowed)
Leo card "TEST leo1, 1 Stern" ticked; Leo layout shift seen after 8000ms; Mama tap at +904ms after it -> Mama y1 completions: 1
Leo card "TEST leo1, 1 Stern" ticked; Leo layout shift seen after 7988ms; Mama tap at +906ms after it -> Mama y1 completions: 1

variant 6 (remote completion of a Mia chore before the taps, second Mama tap at ~700 ms):
remote x1 1 x2 1
remote x1 1 x2 0
remote x1 1 x2 0
control without remote change: none x1 1 x2 1 (2 of 2)

Network log of a failing run: only POST .../<x1>/complete; no POST for x2. No scroll event, no rect change of the x2 card before the tap.
```

## Notes

`src/components/chores/chores-view.tsx` (`lastShiftAt`, `handleLayoutShift`, `handlePress`) and `src/components/chores/member-column.tsx` (effect on `shiftKey` calls `onLayoutShift()`). Keep the guard per column: store `lastShiftAt` in a `Map<columnKey, number>` and call `layoutTapAllowed(map.get(chore.memberId ?? "anyone"), now)`; pass the column key to `onLayoutShift`. For reference, within the same column a tap 106 ms / 309 ms after the re-sort is dropped and one 704 ms after works, which matches the intended 600 ms guard (`LAYOUT_TAP_GUARD_MS`), so only the scope needs fixing.

## Fix

The layout-shift guard is per column now. `MemberColumn` reports its own `columnKey` with every shift, `ChoresBoard` keeps a `Map<columnKey, time>` and `handlePress` asks `layoutTapAllowedIn(shifts, columnKey, now)` (new pure helper in `src/lib/tap-guards.ts`, unit-tested: a shift in Leo's column does not affect Mama's; Leo's own column still drops taps for 600 ms).

Re-run of the reproduction with real touches (`scratchpad/fe-tasks/r4-shift.mjs`): Leo's column re-sorts 8164 ms / 8168 ms after the tick; a tap on Mama's card 100 ms / 120 ms later now completes it (Mama completions: 1 and 1; before: 0).

## Verification

Round 4, 2026-10-01 01:15-01:40 CEST, real CDP mouse events, wall 1280x800.

- Original repro (tick Leo's card, Leo's column re-sorts 8.0 s later, tap Mama's card 100 ms after the re-sort): 28 of 30 runs at +102..+132 ms complete Mama's chore (the last 22 runs in a row: 22/22; before the fix: 2 of 2 swallowed). Tap at +900 ms: 2/2 work.
- Two different cards in one column: 300 ms and 500 ms apart -> second dropped (intended column lock, the card now shakes briefly: a `transform` animation from 276 to 643 ms was recorded on the rejected card); 650 ms and 700 ms (x4) apart -> both complete.
- The 2 failing runs (both among the first 8 runs) fell into the window in which another reviewer was deleting completions of the Leo test chore (01:15-01:18). One of them logged a `scroll` event 1 ms after Leo's re-sort; the remaining cause is the separate global scroll guard, filed as `2026-09-30T23-39-47-scroll-guard-swallows-taps-across-columns.md`. The layout-shift guard itself is per column now.

