---
title: GET /api/mobile/events does not expand recurring events (no synthetic ids, no overrides)
severity: P1
area: backend
owner: backend-developer
status: fixed
slice: mobile event writes (members + events + Flutter calendar/settings)
created: 2026-07-08T11:50:34Z
---

## Reproduction

1. Pair a mobile device, obtain a bearer token (`POST /api/devices/pair`).
2. Create a recurring event via `POST /api/mobile/events`:
   ```json
   {"memberId":"<id>","title":"Standup","startsAt":"2026-07-11T08:00:00Z","endsAt":"2026-07-11T08:15:00Z","rrule":"FREQ=DAILY;COUNT=5"}
   ```
   → 201, single master row created.
3. Fetch the same window: `GET /api/mobile/events?from=2026-07-11T00:00:00Z&to=2026-07-16T00:00:00Z`.
4. Compare with the wall's equivalent: `GET /api/events?from=2026-07-11T00:00:00Z&to=2026-07-16T00:00:00Z` (unauthenticated, same window).

## Expected

Both endpoints read from the same `Event`/`EventOverride` tables and should return the same *set* of occurrences (mobile's response shape differs — `{ events: [...] }` wrapper vs a bare array, and mobile's per-event fields are the trimmed `MOBILE_EVENT_SELECT` — but the recurring series should still expand to one entry per occurrence in range, with synthetic ids `masterId__recurrenceId`, matching `src/lib/event-expansion.ts`'s `expandEventsInRange`, which is exactly what the wall route (`src/app/api/events/route.ts`) already does.

## Actual

The wall correctly returns 5 expanded occurrences with synthetic ids:

```json
["cmrc0ihi5000sr14630je7ci9__2026-07-11T08:00:00.000Z",
 "cmrc0ihi5000sr14630je7ci9__2026-07-12T08:00:00.000Z",
 "cmrc0ihi5000sr14630je7ci9__2026-07-13T08:00:00.000Z",
 "cmrc0ihi5000sr14630je7ci9__2026-07-14T08:00:00.000Z",
 "cmrc0ihi5000sr14630je7ci9__2026-07-15T08:00:00.000Z"]
```

The mobile endpoint returns only the raw master row (a single occurrence, using the master's own `startsAt`/`endsAt`), with a plain (non-synthetic) id:

```json
{"events":[{"id":"cmrc0ihi5000sr14630je7ci9","title":"Standup","description":null,"location":null,"startsAt":"2026-07-11T08:00:00.000Z","endsAt":"2026-07-11T08:15:00.000Z","allDay":false,"color":null,"source":"LOCAL","member":{"id":"...","name":"Bob","color":"mint","emoji":null}}]}
```

Occurrences 2–5 never appear. Per-occurrence overrides (from a prior `PATCH .../<id>?scope=instance`) are silently ignored too, since `MOBILE_EVENT_SELECT` doesn't even select `rrule`, and the route's Prisma query has no `include: { overrides: true }` and never calls `expandEventsInRange`.

Downstream effect on the Flutter app (verified via code review of `mobile/lib/models/event.dart` and `mobile/lib/features/calendar/event_detail_sheet.dart`): `MobileEvent.isRecurringInstance` is `id.contains('__')`. Since the id never arrives as a synthetic id from this endpoint, `_isRecurring` is always `false` in the app, so:
- The user never sees occurrences 2..N of any recurring series in the mobile agenda.
- The instance-vs-series scope picker (`askEventScope`) never triggers — every edit/delete from mobile silently defaults to `scope=series`, editing/deleting the whole series when the user only intended to touch one occurrence.

I confirmed the write-side logic (`updateEvent`/`deleteEvent` in `src/lib/events-write.ts`) works correctly when given a manually-constructed synthetic id directly via curl — PATCH instance, PATCH series, DELETE instance, DELETE series all behaved correctly and were reflected on a subsequent wall `GET /api/events`. The bug is isolated to the mobile GET route not doing expansion.

## Evidence

```text
$ curl -s "localhost:3000/api/mobile/events?from=2026-07-11T00:00:00Z&to=2026-07-16T00:00:00Z" -H "Authorization: Bearer $TOKEN" | jq .
{
  "events": [
    {
      "id": "cmrc0ihi5000sr14630je7ci9",
      "title": "Standup",
      "startsAt": "2026-07-11T08:00:00.000Z",
      "endsAt": "2026-07-11T08:15:00.000Z",
      ...
    }
  ]
}

$ curl -s "localhost:3000/api/events?from=2026-07-11T00:00:00Z&to=2026-07-16T00:00:00Z" | jq 'length, .[].id'
5
"cmrc0ihi5000sr14630je7ci9__2026-07-11T08:00:00.000Z"
"cmrc0ihi5000sr14630je7ci9__2026-07-12T08:00:00.000Z"
"cmrc0ihi5000sr14630je7ci9__2026-07-13T08:00:00.000Z"
"cmrc0ihi5000sr14630je7ci9__2026-07-14T08:00:00.000Z"
"cmrc0ihi5000sr14630je7ci9__2026-07-15T08:00:00.000Z"
```

## Notes

Root cause: `src/app/api/mobile/events/route.ts` `GET` handler does a plain `db.event.findMany({ where: {...startsAt/endsAt...}, select: MOBILE_EVENT_SELECT })` — it never fetches `overrides` and never runs the result through `expandEventsInRange` from `src/lib/event-expansion.ts`, unlike the wall's `src/app/api/events/route.ts` which does both (fetches `include: { overrides: true }` plus a broader `OR` clause to catch series that start before the window, then calls `expandEventsInRange` + post-filter).

Suggested fix shape: extract the wall's query/expand/filter logic (lines 30–57 of `src/app/api/events/route.ts`) into a shared helper in `src/lib/events-write.ts` or a new `src/lib/events-read.ts`, parameterized by `familyId` (mobile) vs family-agnostic (wall, single-family install), and have both routes call it. Also add `rrule: true` to `MOBILE_EVENT_SELECT` if the app needs to know a *master* event's rrule for display before expansion, though the expanded per-occurrence entries just need the synthetic `id`.

This blocks the recurring-instance scope-prompt manual test (test plan step 3) — I verified that part of the flow only by manually crafting synthetic ids via curl, bypassing the broken GET, and by static code review of the Flutter side.

## Fix

Root cause confirmed as diagnosed: `GET /api/mobile/events` queried only exact-window rows via `MOBILE_EVENT_SELECT` and never ran `expandEventsInRange`.

Extracted the wall's query/expand/filter/sort core (previously inlined in `src/app/api/events/route.ts`) into a new shared helper, `fetchExpandedEventRows` in `src/lib/events-read.ts`, so the two `GET` routes can no longer drift:

- `rangeWhere()` builds the same `OR` clause as before (non-recurring events overlapping `[from, to)`, plus recurring series starting `<= to`).
- `fetchExpandedEventRows(filter, include, cap?)` fetches with the caller-supplied Prisma `include` (always requires `overrides: true` at the call site), runs `expandEventsInRange`, optionally enforces `cap` **on the expanded/post-filter count** (not the raw row count — a single master can fan out into many occurrences), post-filters for actual overlap, and sorts by `startsAt`.
- Generic `Extra` type param lets callers type the extra relation fields they include (mobile includes a trimmed `member` select) without `fetchExpandedEventRows` needing to know about them.

Changes:
- `src/lib/events-read.ts` (new) — shared helper described above.
- `src/app/api/events/route.ts` — `GET` now delegates to `fetchExpandedEventRows({ from, to, memberIds }, { overrides: true })`; no cap (matches prior behavior, wall never had one); response shape unchanged (full `Event` rows + `seriesId`/`isRecurring`, no `member` relation, exactly as before).
- `src/app/api/mobile/events/route.ts` — `GET` now calls `fetchExpandedEventRows({ from, to, familyId, memberIds }, { overrides: true, member: { select: {...} } }, EVENT_CAP)`, mapping expanded rows down to the trimmed `{ id, title, description, location, startsAt, endsAt, allDay, color, source, member }` shape. Removed the separate pre-fetch `db.event.count()` cap check (that counted raw rows, not occurrences); the cap is now enforced by the shared helper on the expanded count, per the report's guidance. Response wrapper (`{ events: [...] }`) unchanged.
- `src/lib/events-write.ts` — untouched; `MOBILE_EVENT_SELECT`/`getMobileEvent` still used by mobile POST/PATCH for returning a single master row (no expansion needed there).

### Verification

- `node node_modules/typescript/lib/tsc.js --noEmit` — clean.
- `grep -n "console\." src/lib/events-read.ts src/app/api/events/route.ts src/app/api/mobile/events/route.ts` — no matches (no secrets/logging added).
- Manual end-to-end against a scoped test family/member (`Testers` / `Alice`, pre-existing dev data, untouched):
  1. Inserted a `PairingCode` row directly, paired via `POST /api/devices/pair` → bearer token.
  2. `POST /api/mobile/events` with `rrule: "FREQ=DAILY;COUNT=5"` → single master row created (id `cmrc0w26k00031athxc755vz8`).
  3. `GET /api/mobile/events?from=2026-07-11T00:00:00Z&to=2026-07-16T00:00:00Z` → **5 occurrences**, synthetic ids `cmrc0w26k00031athxc755vz8__2026-07-1{1..5}T08:00:00.000Z`, each with the full trimmed shape incl. `member`.
  4. `GET /api/events` over the same window → same 5 synthetic ids (wall route unaffected/still correct after refactor).
  5. `PATCH /api/mobile/events/cmrc0w26k00031athxc755vz8__2026-07-13T08:00:00.000Z?scope=instance` with `{"title":"Standup (moved)","location":"Room 2"}` → `{"ok":true}`.
  6. Re-`GET /api/mobile/events` same window → occurrence 3 shows `title: "Standup (moved)"`, `location: "Room 2"`; occurrences 1,2,4,5 unchanged (`title: "Standup"`, `location: null`) — override correctly scoped to the single instance.
  7. Cleaned up: deleted the test `EventOverride`, `Event`, `MobileDevice`, `PairingCode` rows by id/code via scoped `sqlite3` `DELETE`s; verified 0 rows remain for each. Pre-existing dev data (`Testers` family, `Alice` member, etc.) untouched.
  8. Dev server (started via `DATABASE_URL="file:../data/app.db?connection_limit=1" node node_modules/next/dist/bin/next dev`) killed after verification.

Downstream: Flutter's `MobileEvent.isRecurringInstance` (`id.contains('__')`) will now correctly detect instances from this endpoint, so occurrences 2..N render in the agenda and `askEventScope` fires on edit/delete — no mobile-side change needed for this fix (mobile code was already correct per the report; it was starved of synthetic ids by the backend).
