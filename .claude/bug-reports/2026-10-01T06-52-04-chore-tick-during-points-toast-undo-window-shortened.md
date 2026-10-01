---
title: Chore ticked while the "zurückgesetzt" toast is showing gets its undo toast late and with a shortened window
severity: P3
area: frontend
owner: frontend-developer
status: verified
slice: points-overview
created: 2026-10-01T06:52:04Z
---

## Reproduction

1. Demo state: Leo balance 2. `/chores` wall 1280x800, parent mode on (it stays on for up to 2 min, so a child can tick right after the parent returned to the board).
2. "Punkte" -> "Zurücksetzen" on Leo -> confirm. The toast "Leo: 2 Sterne zurückgesetzt" with ↶ appears for 8 s.
3. While it is visible, tick a chore for Leo ("Schultasche packen"). Watch the toast area for the next ~12 s (poll every 50 ms).

## Expected

Ticking a chore gives its own "Leo bekommt 1 Stern" toast with a full 8 s ↶ window (E13: undo only exists in the toast), also right after a reset.

## Actual

The chore toast is suppressed while the reset toast is up. It only appears when the reset toast ends, and its window is what is left of the 8 s that started at the tick. A tick ~3 s into the reset toast leaves ~2.8 s of visible toast, of which the first 600 ms are inert. A tick in the first ~1 s after the reset toast appeared leaves no usable undo at all, so a wrong tap permanently awards a star (there is no other undo path).

## Evidence

```text
# toast area polled every 50 ms; chore tapped at ~3014 ms
  52   -
  327  Leo: 2 Sterne zurückgesetzt            <- reset toast (8 s)
  8360 🦖 / Leo bekommt 1 Stern / +1           <- chore toast only after the reset toast is gone
  11193 -                                      <- expiresAt = tick + 8 s, so only ~2.8 s visible
```

## Notes

- `src/components/chores/chores-view.tsx`, bottom of `ChoresBoard`: `errorToast ? KidToast : points.toast ? PointsToast : DoneToast`. The `DoneEntry.expiresAt` is absolute (`tick + 8 s`), so hiding `DoneToast` eats into its window.
- Options: render both (stacked / side by side), give the chore toast priority and pause the reset toast, or restart the chore toast's `expiresAt` when it becomes visible. Decide which one is the intended trade-off with the reset ↶.

## Fix

Both toasts are now rendered. The one that appeared first keeps the bottom place, a newcomer sits one toast higher (`lift` on `ToastShell`/`KidToast`/`DoneToast`/`PointsToast`, `TOAST_LIFT_PX = 80`, decided by `useToastLift`). Nothing moves under a finger: the lower toast never changes position, and when it ends the upper one stays where it is until it ends. The chore toast starts with its full 8 s window the moment the tick happens.

Verified with touch (`points-test/s31.mjs`, wall and phone): tick at ~3.0 s into the reset toast, chore toast visible from 3.15 s to 11.15 s, reset toast stays at its position (712-788) and the chore toast sits at 632-708. Touch on the chore ↶ undoes the tick, touch on the reset ↶ restores the balance while the other toast is up. A chore error toast still replaces both, as before.

## Verification

Retested 2026-10-01 against the fresh production build on :3100 with `Input.dispatchTouchEvent` on wall (1280x800) and phone (390x844), scripts `points-test/t3a.mjs`, `t3a2.mjs`, `t4.mjs`, `t5.mjs`:

- Timeline (50 ms polling), reset toast at 0.3 s, tick at ~3.0 s: chore toast mounts at 3.17 s and is visible until 11.19 s (8.0 s, full window). Reset toast keeps its place (wall 712-788, phone 687-761) and ends at ~8.3 s. The chore toast stays at 632-708 (phone 607-681) until it ends. Lift is 80 px on both.
- Touch undo, chore toast first: tick undone (Leo balance 1 -> 0, pill 0), reset toast unchanged; then touch on the reset ↶ restores 2. Reset ↶ first: balance 3 (reset undone, tick kept), chore toast stays in place; then chore ↶: 2. Same results on wall and phone.
- Reverse order (chore toast first, reset toast second): the chore toast keeps the bottom slot, the reset toast sits 80 px higher; both ↶ work by touch on wall and phone.
- Hit tests while both toasts are up (state read from the API after each tap, nothing undone): wall taps at 4 px and 14 px above the lifted toast (on the ↶ x and centre), in the 4 px gap between the toasts, and 4 px below the lower toast hit cards or page, never a ↶; Leo's balance and both toasts unchanged. Phone: taps above the lifted toast and in the gap are swallowed by the toast strip (`elementFromPoint` is the toast), nothing undone.
- No console errors.
