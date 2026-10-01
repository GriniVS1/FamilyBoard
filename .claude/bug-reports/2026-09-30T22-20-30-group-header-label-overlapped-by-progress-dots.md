---
title: Group header label ("Jederzeit", "Tagsüber"…) is cut and overlapped by the progress dots once a group has 4+ chores (4-person wall, 1280 px)
severity: P2
area: frontend
owner: frontend-developer
status: verified
slice: kid-friendly-ui
created: 2026-09-30T22:20:30Z
---

## Reproduction

1. Wall 1280x800, `/chores`, 4 people so every column is 267 px wide (current demo family).
2. Give one person 4-6 chores in the same time-of-day group. I created `TEST y1…y5` (POST `/api/chores`, `memberId` = Mama, no `timeOfDay`), so Mama's "Jederzeit" group holds 6 chores together with "Pflanzen giessen".
3. Look at Mama's group header row. Measure the label: `label.clientWidth` vs `label.scrollWidth`.
4. Repeat with `fb_locale` cookie en/fr/it and on the phone (390 px).

## Expected

The group label stays readable next to the progress dots (AK-2 spirit: no cut text; R1-12 asked for dots up to 6). If the row is too tight, the dots shrink (smaller dots, or overflow into "4/6") rather than the label.

## Actual

The dots pill keeps its full width (6 dots ~ 140 px) and the label gets whatever is left. With 6 chores the label is squeezed to 23 px of 78 and the dots are painted over it ("Jed○○○○○○"). With 4 chores (Pflanzen + y1..y3) it is 63 of 78 px, the last letters are clipped. Other groups are affected the same way as soon as they hold 4-6 chores; "Jederzeit" is the widest de label. Phone columns are wide enough (no clipping).

## Evidence

```text
de wall  Mama Jederzeit  label 23/78 px  CUT   (6 chores)   other columns (3-4 dots): 119/119, 83/83, 162/162 -> fine
en wall  Anytime 23/68 CUT | fr wall "Quand tu veux" 23/54 CUT | it wall "Quando vuoi" 23/65 CUT
phone (all locales): 114/114 OK
Screenshot: scratchpad/r3/out/hdr-wall-6dots.png (label "Jed" under the dots)
audit snippet 4.3 on /chores wall: cut=1 ["Jederzeit"]
```

## Notes

`src/components/chores/time-of-day-header.tsx`: the label is `<span class="kid-title min-w-0 flex-1 …">` (no `truncate`, no `shrink-0`) and the dots pill (`ProgressDots`, `size-4` dots + `px-2.5`) is `inline-flex` without a max width, so the flex row lets the label collapse to its min-content of 0 and the text overflows under the pill. Options: give the label `shrink-0`/`min-w-[5ch]` and cap the dots at ~4 with a "+N" or a number for larger groups, or shrink the dots (`size-3`) when `total > 4`. The pill also uses a fixed `size-4` per dot, so the width grows with `total` (6 dots = 140 px of the 235 px usable).

## Fix

`src/components/chores/time-of-day-header.tsx`: progress dots only up to 4 (smaller, 14 px); more chores show the number ("3/6"). The expanded header has no chevron any more, the pill is `shrink-0` and the label keeps the rest of the row (`truncate` only as a last resort).

Measured with 6 chores in Mama's "Jederzeit" group, 267 px wall column and 358 px phone column, in de/en/fr/it (`scratchpad/fe-tasks/r4-label.mjs`): label 147/147 px on the wall, 238/238 px on the phone, 8 px clear of the pill in all 8 combinations ("Jederzeit", "Anytime", "Quand tu veux", "Quando vuoi"); none cut, none covered.

## Verification

Round 4, wall 1280x800 (267 px columns) and phone 390x844, Mama's "Jederzeit" group with 6 chores (Pflanzen giessen + TEST y1..y5), locale forced via `fb_locale` cookie:

- Label fully visible, no `scrollWidth` overflow, in all 8 combinations: de "Jederzeit" 147/147 px (wall) and 238/238 (phone), en "Anytime", fr "Quand tu veux", it "Quando vuoi" identical numbers.
- The header shows the number pill "0/6" instead of six dots (groups with 3-4 chores still show dots, e.g. Leo's three dots); the expanded header is 48 px high and has no chevron. Screenshot `scratchpad/r4/out/hdr-wall.png`.
- Collapsed rows and other columns unchanged; audit snippet `cut` for chore cards 0.

