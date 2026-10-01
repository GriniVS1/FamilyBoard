---
title: Punkte overview and reset confirmation show stale numbers for up to 30 s after a chore is ticked or undone
severity: P2
area: frontend
owner: frontend-developer
status: verified
slice: points-overview
created: 2026-10-01T06:52:03Z
---

## Reproduction

1. Demo state: Mia balance 10. `/chores` wall 1280x800, parent mode on.
2. Tap "Punkte": Mia shows 10, "diese Woche +6", "insgesamt 10". Close the overview.
3. Within 30 s, tick a chore for Mia on the board (e.g. "Zähne putzen"). The column pill goes to 11.
4. Within 30 s of step 2, tap "Punkte" again.
5. Tap "Zurücksetzen" on Mia.

## Expected

The overview opens with the current numbers (Mia 11, week +7, total 11) and the confirmation reads "11 -> 0". The same applies after a toast-undo of a tick, and for the enabled/disabled state of the reset buttons and "Alle zurücksetzen".

## Actual

The overview shows the cached values from step 2 (Mia 10 / +6 / 10) and keeps showing them (still unchanged 1.5 s after opening, no refetch). The confirmation says "10 -> 0" while the server balance, and the pill on the same screen, say 11. The reset then clears 11 and the toast says "Mia: 11 Sterne zurückgesetzt". A person with a stale 0 would also keep a disabled "Zurücksetzen" button although they have stars.

## Evidence

```text
open #1 Mia: 🦄 | Mia | 10 | diese Woche +6 | insgesamt 10 | seit Beginn | Zurücksetzen
server Mia: {"balance":11,"since":null,"weekly":7,"allTime":11,"history":[]}
Mia pill: 11 Sterne
open #2 (<30s later) Mia: 🦄 | Mia | 10 | diese Woche +6 | insgesamt 10 | seit Beginn | Zurücksetzen
open #2 +1.5s Mia:        🦄 | Mia | 10 | diese Woche +6 | insgesamt 10 | seit Beginn | Zurücksetzen
confirm text: 🦄 / Mia: Sterne auf 0 setzen? / 10 / 0 / Die erledigten Aufgaben bleiben erhalten.
```

## Notes

- `src/components/providers/query-provider.tsx` sets `staleTime: 30_000` globally. `usePointsQuery` (`src/components/points/use-points.ts`) uses `POINTS_QUERY_KEY` with no override, and the complete/undo mutations in `src/components/chores/use-chores.ts` only touch `CHORES_QUERY_KEY`. `PointsPanel` is unmounted while the dialog is closed, so reopening within 30 s serves the cache without a refetch.
- Likely fix: `refetchOnMount: "always"` (or `staleTime: 0`) on `usePointsQuery`, and/or invalidate `POINTS_QUERY_KEY` after complete/undo. Reset/undo-reset already invalidate both keys, so that path is fine.

## Fix

`usePointsQuery` now has `staleTime: 0` and `refetchOnMount: "always"`, so every opening of the overview loads fresh numbers. The complete/undo queue in `use-chores.ts` also invalidates `["points"]` next to `["chores"]` (the key moved to `src/components/points/query-key.ts` to avoid an import cycle).

Verified with `points-test/s20.mjs`: after ticking a chore for Mia, reopening within 30 s shows 11 / +7 / 11 at once and the confirmation reads 11 -> 0.

## Verification

Retested 2026-10-01 against the fresh production build on :3100 (wall, touch events, `points-test/t2.mjs` and `t2b.mjs`):

- Mia 10 / Mama 0 in the overview. Close, tick a chore for Mia and for Mama on the board, reopen within seconds: overview shows Mia 11 / "diese Woche +7" / "insgesamt 11", Mama 1 / +1 / 1 at once, and Mama's "Zurücksetzen" is enabled. The confirmation reads "11 -> 0". Server values identical.
- Tick Mia (12), undo via the toast (11), reopen immediately: overview shows 11 / +7 / 11.
- No console errors.
