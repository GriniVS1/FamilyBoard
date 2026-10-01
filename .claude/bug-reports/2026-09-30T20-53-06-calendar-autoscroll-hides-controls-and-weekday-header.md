---
title: Calendar auto-scroll to "now" scrolls the whole page and hides view switch, person filter, "Neues Ereignis" and the weekday header
severity: P2
area: frontend
owner: frontend-developer
status: verified
slice: kid-friendly-ui
created: 2026-09-30T20:53:06Z
---

## Reproduction

1. Open `http://localhost:3100/calendar` at wall size (1280x800), local time after ~09:00 (I used 22:48, plus timezone overrides for other hours). Default view is "Woche".
2. Without touching anything, read the positions of the header controls: `document.querySelector('[aria-label="Nur Mia anzeigen"]').getBoundingClientRect().top`, same for "Neues Ereignis", the "Tag/Woche/Monat" buttons and the weekday labels MO/DI/MI…
3. Try to tap the person filter, e.g. "Nur Mia anzeigen", at its reported position.
4. Repeat at phone size (390x844, day view) and with `Emulation.setTimezoneOverride` for 10:2x, 16:2x.

## Expected

R1-14 asked for the grid to start near "now" so the "Jetzt" line is visible. The controls that make the calendar usable for a child (avatar solo filter = AK-24, Tag/Woche/Monat, date arrows, "Neues Ereignis") and the weekday header row of the week grid stay reachable, e.g. by scrolling only the time grid (inner scroll container) with a sticky weekday header, or by keeping the header sticky under the top bar.

## Actual

`calendar-view.tsx` calls `window.scrollTo(...)`, so the page itself scrolls until "now minus 1 h" sits under the top bar. Everything above the grid (arrows, "Heute", Tag/Woche/Monat, "Neues Ereignis", the person filter) and the weekday/date header row (MO 28 … SO 4) are then above the viewport, at negative y. A tap at their position hits nothing. From 10:2x on this happens on every open; only the early morning (05:2x, scrollY 0) is unaffected. In the week view the columns have no day labels any more, only the highlighted today column hints at the date. To use the solo filter a child must first scroll the page back up, which nothing suggests.

## Evidence

```text
wall, 05:2x  scrollY=0    newEvent visible  filter visible  weekday header visible
wall, 10:2x  scrollY=520  newEvent hidden   filter hidden   weekday header hidden
wall, 16:2x  scrollY=809  newEvent hidden   filter hidden   weekday header hidden
wall, 22:2x  scrollY=809  newEvent hidden   filter hidden   weekday header hidden
phone,10:2x  scrollY=628  filter hidden
phone,22:2x  scrollY=937  filter hidden

$ tap "Nur Mia anzeigen" without scrolling up first: {"ok":true,"r":{"y":-588,...}}  -> nothing happens
$ tap "Tag" / "Woche" / "Neues Ereignis": y=-658 -> nothing happens
Screenshot: scratchpad/r2/out/b1-0-week.png (no header, no weekday labels, grid starts at 13:00)
```

## Notes

`src/components/calendar/calendar-view.tsx` lines ~82-99 (`window.scrollTo({ top: … })` on open, view change and "Heute"). The page-level scroll is also why the auto-scroll clamps to the page bottom in the evening (13:00 at the top at 22:48 instead of 21:00). Suggested fix: give the timed grid its own `overflow-y-auto` container with `position: sticky` weekday header and scroll that container (`scrollTop`) to now-1h; keep the header/filter row in normal flow above it. If the page-level scroll is kept, at least make the filter row and view switch sticky below the top bar.

## Fix

The page never scrolls on open any more; only the grid box does.

- `calendar/calendar-view.tsx`: the views sit in one `overflow-y-auto` box whose height is computed (`calendar/use-fill-height.ts`) so it ends at the page's bottom padding. "Now minus 1 h" is applied with `scroller.scrollTo`, also for "Heute" and for the new "+N" block. Navigation, Tag/Woche/Monat, "Neues Ereignis" and the person filter stay in normal flow above the box.
- `view-week.tsx`, `view-day.tsx`, `view-month.tsx`: the weekday/date row and the all-day row are one `sticky top-0` head (`data-calendar-head`); the old rounded `overflow-hidden` card moved to the scroll box.
- `calendar-header.tsx`: on a phone "+" shares the first row with the arrows and the tabs take the second, so the box gets the space (title only in the month grid; week head shows the month in the gutter, day head "Mittwoch · September").

Verified with a timezone override (10:xx Honolulu, 16:xx New York, 22:xx Zurich), wall 1280x800 / tablet 768x1024 / phone 390x844 (`scratchpad/fe-shell/cal-tz.mjs`, images `caltz-*.png`): `pageScrollY` 0 and document height = viewport in all 9 runs; arrows, "Heute", tabs, "Neues Ereignis" and the filter sit at y 68-385 (inside the viewport); the "Jetzt" line lies inside the scroll box every time.

## Verification

Round 3, 2026-09-30 23:30-00:10 CEST, real CDP input, timezone overrides 06:xx (Tokyo), 11:xx (Honolulu), 17:xx (New York), 23:xx (Zurich) x wall 1280x800 / tablet 768x1024 / phone 390x844 (12 runs):

- `pageScrollY` 0 and document height equals the viewport in all 12 runs. Arrows, "Heute", Tag/Woche/Monat, "Neues Ereignis" (phone: "+") and the person filter are inside the viewport every time; the `[data-calendar-head]` row (weekday/date + all-day row) is visible.
- The grid box scrolls itself to "now minus 1 h": scrollTop 0 / 257 / 641 / 797 (wall), the "Jetzt" label is visible in all 12 runs (e.g. 23:31 at y=734 on the wall).
- Sticky head: setting the box `scrollTop` to 0 and to 400 leaves the head at the same y (294), so the weekday labels never scroll away.
- "Nur Mia anzeigen" tapped without scrolling -> only Mia's events (`aria-pressed` true, blocks: Kindergarten, Schwimmen x2, Schwimmen 10:00); "Alle" restores.
- "+N": with 3 overlapping events (23:00 / 23:15 / 23:30) the week shows "Schwimmen" plus a "+2 weitere" block; tapping it switches to the day view of that date (title "Mittwoch, 30. September") with all three events listed.
- Month view: page scroll 0, events listed. Creating, editing and deleting events via the dialogs and tapping an empty slot (opens "Neues Ereignis" with 08:00-09:00) also work. Console: 0 errors.

