---
title: Star counter stays scaled to 130 percent after every increase (pulse never returns to 1.0)
severity: P2
area: frontend
owner: frontend-developer
status: fixed
slice: mobile kids-UI screens (Aufgaben, Heute) 0.3.0
created: 2026-10-02T10:12:11Z
---

## Reproduction

1. Open Aufgaben (or Heute) as Mia with motion enabled (disableAnimations=false), counter shows "2 heute".
2. Tick a chore (+3). The counter goes to 5 and pulses.
3. Wait more than 1 s. Observe the counter pill.

## Expected

R5.6: the counter pulses once (about 420 ms) and settles back to its normal size.

## Actual

The pill stays enlarged to scale 1.3 permanently: larger number and "heute" label, and it overlaps the avatar next to it. It only shrinks on the next rebuild that recreates the widget. With reduced motion the pulse is skipped, so the defect only shows on the normal-motion path. Simulator screenshots (iPhone 17 Pro, light) taken 5 s and 6 s after the tick show the enlarged pill, both after a successful tick (5 heute) and after a failed tick that rolled the number back (2 heute).

## Evidence

Widget test in a scratch copy (KidStarCounter, count 2 then 5, pump over time, read ScaleTransition.scale):

```text
t=0    scale=1.0022
t=100  scale=1.2057
t=210  scale=1.2184
t=420  scale=1.3
t=1000 scale=1.3
t=3000 scale=1.3
```

## Notes

mobile/lib/kids/kid_stars.dart, class `_Bounce` (`transformInternal` returns sin(t*pi)). Flutter's `Curve.transform` short-circuits t == 0.0 and t == 1.0 and returns t without calling `transformInternal`, so at the end of the animation the curve yields 1.0 and the Tween(1 to 1.3) ends at 1.3. Fix idea: TweenSequence (1 to 1.3 to 1) instead of a sine curve, or override `transform` instead of `transformInternal`. Add a test that asserts the scale is 1.0 after 1 s; none of the 307 tests checks the end state.

## Fix

`mobile/lib/kids/kid_stars.dart`: the `_Bounce` curve is gone. The pulse is now a `TweenSequence` (1.0 to 1.3 with easeOut, 1.3 to 1.0 with easeInOut), so the animation's end value is the rest value and the pill cannot stay enlarged, whatever `Curve.transform` does at t = 1.

New `mobile/test/kids_star_counter_test.dart`:
- normal motion: peak scale is > 1.2 and <= 1.3 during the pulse, and exactly 1.0 after 600 ms and after 3 s more;
- a second increase mid-pulse also ends at exactly 1.0;
- reduced motion: scale is 1.0 on every frame, the number still updates.
