---
title: To-do due-date popover feeds an ISO datetime to <input type="date"> (field stays blank, browser warning)
severity: P3
area: frontend
owner: frontend-developer
status: verified
slice: kid-friendly-ui
created: 2026-09-30T19:41:32Z
---

## Reproduction

1. Open `/todos`. "Velo flicken" has a due date (pill "Heute"; `GET /api/todos` -> `dueDate: "2026-09-30T10:00:00.000Z"`).
2. Tap the due pill (aria-label "Fälligkeitsdatum") to open the popover.
3. Read the date input: `document.querySelector('[role=dialog] input[type=date]').value`.
4. Alternatively set a date on a to-do with "Morgen" and watch the console.

## Expected

The date field shows the current due date (`2026-09-30`), so a parent can see and adjust it. No console warnings.

## Actual

The date field is empty (`""`) for a to-do that already has a due date. Setting a date via "Heute"/"Morgen" logs browser warnings because the `value` is an ISO datetime, not `yyyy-MM-dd`.

## Evidence

```text
date input value: ""          (to-do "Velo flicken" has dueDate 2026-09-30T10:00:00.000Z)
console.warn: The specified value "2026-10-01T00:00:00.000Z" does not conform to the required format, "yyyy-MM-dd".
console.warn: The specified value "2026-09-30T00:00:00.000Z" does not conform to the required format, "yyyy-MM-dd".
```

## Notes

`src/components/todos/todo-row.tsx:147-148`: `type="date"` with `value={todo.dueDate ?? ""}`. Needs `todo.dueDate?.slice(0, 10)` (dates are stored as UTC midnight by the quick buttons, but the seed/other clients may store other times, so slice the date part rather than converting to local). Line is unchanged versus HEAD (pre-existing), but this popover is part of the to-do re-dating flow in this slice.

## Fix

`src/components/todos/todo-row.tsx`: the date input gets `format(parseISO(todo.dueDate), "yyyy-MM-dd")` (local date, consistent with the pill / overdue logic) instead of the raw ISO string.

Verified on `/todos`: the popover of "Velo flicken" (`2026-09-30T10:00:00.000Z`) shows `2026-09-30`; after "Morgen" it shows `2026-10-01`; console has 0 warnings (`fe-shell/console-check.mjs`).

## Verification

Round 2 on `/todos`:

- "Velo flicken" (`dueDate 2026-09-30T10:00:00.000Z`): popover date input value `"2026-09-30"`. TEST to-do with `2026-10-05T00:00:00.000Z`: `"2026-10-05"`, pill "5. Okt.".
- "Morgen" -> input shows `2026-10-01`; picking `2026-10-12` through the input -> DB `1791763200000`, pill "12. Okt."; "Heute" -> input `2026-09-30`; popover "Löschen" clears the date.
- Console: 0 warnings/errors during all of the above.
