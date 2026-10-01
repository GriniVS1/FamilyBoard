---
title: Tapping a chore again right after undo is silently ignored while the first POST is still in flight
severity: P3
area: frontend
owner: frontend-developer
status: verified
slice: kid-friendly-ui
created: 2026-09-30T19:41:31Z
---

## Reproduction

1. Open `/chores` (wall 1280x800) and pick an open chore (I used a TEST chore for Mama, "TEST Mama evening", 2 stars).
2. Slow the network so the POST takes ~1 s: CDP `Network.emulateNetworkConditions {latency: 900}`.
3. Tap the card (-> done, star counter 0 -> 2).
4. 150 ms later tap the card's ↶ (-> open, counter back to 0).
5. 100 ms later tap the card again (intent: complete it again).
6. Wait 6 s and look at the card and at `ChoreCompletion`.

## Expected

The second tap completes the chore again (card done, +2 stars, one row in `ChoreCompletion`), or at least gives feedback. Undo followed by a new tap is a normal correction pattern.

## Actual

The second tap does nothing: no state change, no toast, no error. After the requests settle the card is open and the DB has 0 rows. The kid has to notice and tap a third time. On the local network the window is only a few ms, but on a weak Pi WiFi link it is easy to hit.

## Evidence

```text
after tap (150ms):      {"pressed":"true","star":"2"}
undo tapped true state: {"pressed":"false","star":"0"}
re-tap (inflight):      {"pressed":"false","star":"0"}
settled: ui             {"pressed":"false","star":"0"} db 0
```

## Notes

`src/components/chores/use-chores.ts`, `useChoreActions.complete`: `if (inflight.current.has(chore.id)) return;` is still true for the first (deferred-undo) POST, so the new tap is dropped. `undo()` for a `tmp-` completion only adds the id to `cancelledTmp` and returns; the chore stays in `inflight` until the POST lands and the follow-up DELETE finishes. Fix idea: key `inflight` by completion/tmp id (or clear the chore's inflight flag when a tmp completion is cancelled) and let the new complete queue behind the pending DELETE. Note the server dedupe (5 s per chore+member, `src/lib/chores.ts`) would then return the about-to-be-deleted row for the second POST, so the order POST -> DELETE -> POST has to be serialised client-side.

## Fix

`src/components/chores/use-chores.ts`: the per-chore `inflight` guard is gone. Requests for one chore now run through a per-chore promise chain, so a new tick waits behind the pending POST and its deferred DELETE (server dedupe cannot hand back the row that is about to be deleted). The duplicate-tap guard is now "a completion for this chore is already in the cache". The optimistic state flips immediately for every tap.

Verified with real CDP clicks and `latency: 900` (tick, undo after 150 ms, re-tap after 100 ms): card ends done, star counter 1, exactly 1 `ChoreCompletion` row (`scratchpad/fe-tasks/r2-queue.mjs`).

## Verification

Round 2, real CDP mouse events with `Network.emulateNetworkConditions {latency: 900}`:

- Because the ↶ is now inert for 600 ms, the repro was re-timed: tap card (t=0), ↶ in the toast at t=700 ms, re-tap the card at t=900 ms while the first POST is still in flight.
- Result at t=971 ms: card `aria-pressed=true`, star counter 1. After 7 s and after resetting the latency: still done, `ChoreCompletion` count for the chore = 1, `GET /api/chores` `completionsToday` has 1 entry. No stray row, no dropped tap.
- Double-tap variants also fine (see round-2 summary): 300 ms double tap keeps the card done (mouse and CDP touch events, wall and phone), ↶ ignored at ~250 ms and works at ~1 s, reveal of an old done card + second tap at 300 ms does not undo.
