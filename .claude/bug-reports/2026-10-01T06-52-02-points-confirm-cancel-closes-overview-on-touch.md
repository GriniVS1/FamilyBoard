---
title: Touch-tapping "Abbrechen" in the reset confirmation also closes the Punkte overview
severity: P2
area: frontend
owner: frontend-developer
status: verified
slice: points-overview
created: 2026-10-01T06:52:02Z
---

## Reproduction

1. Open `/chores` on a touch viewport (wall 1280x800, tablet 768x1024 or phone 390x844, touch emulation on), enter parent mode with the PIN.
2. Tap "Punkte" (overview opens), tap "Zurücksetzen" on Leo (balance 2). The confirmation "Leo: Sterne auf 0 setzen?" opens on top of the overview.
3. Tap "Abbrechen" with a touch (touchStart/touchEnd).
4. Observe: both dialogs are gone. The page is back on the board, parent mode is still active.
5. Repeat step 3 with a mouse click, Esc, or a tap on the dimmed backdrop: only the confirmation closes and the overview stays open.

## Expected

Cancelling the confirmation returns to the overview (the spec flow is: overview -> confirmation -> toast). Only a completed reset closes the overview (`confirmReset` does that explicitly).

## Actual

On touch input the overview closes together with the confirmation. A parent who taps "Abbrechen" has to tap "Punkte" again. The wall is a touchscreen, so this is the primary input path.

## Evidence

```text
# CDP touch emulation, wall 1280x800 (same on tablet and phone)
confirm: ["Punkte  Wer hat wie viele Ster","🦖 Leo: Sterne auf 0 setzen? 4"]
after Abbrechen (touch): []

# same flow, different input
cancel via mouse:        dialogs left -> ["Punkte  Wer hat wi"]
cancel via keyboard-esc: dialogs left -> ["Punkte  Wer hat wi"]
cancel via backdrop-tap: dialogs left -> ["Punkte  Wer hat wi"]
cancel via touch:        dialogs left -> []

# event trace for the touch tap (ms | event | pointerType | target | dialogs in DOM)
32  | pointerdown | touch | BUTTON Abbrechen | 2
150 | click       | touch | BUTTON Abbrechen | 2
156 | DIALOGS     |       |                  | 1     <- confirmation unmounted
184 | DIALOGS     |       |                  | 0     <- overview closed, no further pointer event in between
186 | focusin     |       | BUTTON Punkte    | 0     <- useRestoreFocus of the overview
```

## Notes

- Not reproducible with the existing chore edit dialog -> delete confirmation: touch "Abbrechen" there leaves the "Aufgabe bearbeiten" dialog open. Both use the same `Dialog`/`ConfirmDialog` with the confirmation as a React sibling, so the difference is something specific to `src/components/points/points-overview.tsx`.
- Unverified hypothesis: Radix `DismissableLayer` treats the deferred touch `click` as a pointer-down-outside of the overview once the confirmation layer has unmounted. Worth checking how `chore-dialog.tsx` avoids it (nesting, `onOpenChange` handling), and the `useEffect([active, onOpenChange])` / `Dialog open={open && active}` wiring in `PointsOverview`.
- The overview's reset-confirm path (Zurücksetzen) is unaffected, it closes the overview on purpose.

## Fix

Cause: Radix judges a touch pointerdown only on the following `click`. By then the confirmation had unmounted, the overview was the top layer again, and the tap on "Abbrechen" counted as outside it. `PointsOverview` now ignores pointer-down-outside events whose original target sits in another `[role=dialog]` (`keepOpenForNestedDialog` in `src/components/points/points-overview.tsx`). A tap on the overview's own backdrop still closes it.

Verified with `Input.dispatchTouchEvent` on wall, tablet and phone (`points-test/s7.mjs`): the overview stays after "Abbrechen". `s32.mjs`: backdrop tap on the overview closes it, backdrop tap on the confirmation closes only the confirmation, a confirmed reset closes the overview and shows the toast.

## Verification

Retested 2026-10-01 against the fresh production build on :3100 with `Input.dispatchTouchEvent` (own script `points-test/t1.mjs`, wall 1280x800, tablet 768x1024, phone 390x844):

- Touch "Abbrechen" on the reset confirmation, 3x in a row per size: only the confirmation closes, the overview stays (`["Punkte  Wer hat "]` each time).
- Touch on the backdrop while the confirmation is open: only the confirmation closes, the overview stays.
- Touch on the overview's own backdrop, touch on the X, and Esc: the overview closes.
- Confirmed reset: overview closes, toast "Leo: 2 Sterne zurückgesetzt" appears, touch on its ↶ restores the balance (pill back to 2).
- No console errors.
