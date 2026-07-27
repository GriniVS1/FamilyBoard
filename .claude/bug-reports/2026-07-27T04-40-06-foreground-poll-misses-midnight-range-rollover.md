---
title: 30s foreground poll cannot refresh Heute/Demnächst across a midnight rollover if the app is never backgrounded
severity: P2
area: frontend
owner: mobile-developer
status: fixed
slice: mobile auto-refresh (data_refresh.dart / foreground_poll_controller.dart / session_provider.dart)
created: 2026-07-27T04:40:06Z
---

## Reproduction

1. Sign into the mobile app, land on `HomeScreen`, leave it open and in the
   foreground continuously (no pause/inactive/resume cycle at all — e.g. the
   phone stays unlocked and on the home screen, or is plugged in with
   auto-lock disabled) so that `_HomeScreenState.build()` never re-runs.
2. Let the device clock cross local midnight while the app stays foregrounded
   like this. The 30s `ForegroundPollController` keeps ticking the whole
   time.
3. After midnight, observe the Heute / Demnächst cards: the date window they
   are bound to (`range` computed in `_HomeScreenState.build()`) is still
   yesterday's `EventsRange(from: yesterdayMidnight, to: yesterdayMidnight+8d)`.
4. Try pull-to-refresh on the Heute card. The spinner completes, but the
   visible cards do not update to a corrected window.

## Expected

Either the 30s poll or a manual pull-to-refresh should be able to bring the
Heute/Demnächst cards back in sync with "today" once the calendar day rolls
over, without requiring the user to background/foreground the app.

## Actual

Neither can, by construction:

- `_HomeScreenState.build()` computes `range = homeEventsRange()` once per
  widget rebuild and hands it down as a plain constructor arg to `_HeuteCard`
  / `_DemnaechstCard`, which watch `eventsProvider(range)` — i.e. `range` is
  frozen to whatever it was at the *last* rebuild, not re-derived from the
  wall clock on every frame.
- `HomeScreen`'s own rebuild trigger is `ref.watch(sessionProvider)`; nothing
  else in `build()` is watched. In practice the thing that actually forces a
  rebuild across days is the *pre-existing, unrelated*
  `_HomeScreenState.didChangeAppLifecycleState` → `_checkAndReenrollFcm()` →
  unconditional `setState()` on every `resumed` event. If that never fires
  (app never paused), nothing recomputes `range`.
- The new `_pollTick()` / `_onResumed()` paths in `session_provider.dart`
  call `invalidateVisibleHomeProviders(ref.invalidate)`, which internally
  calls `homeEventsRange()` **again, independently**, at invalidate-time.
  Once the day has rolled over, this computes *today's* range — a different
  `EventsRange` value than the one the still-unrebuilt widget is watching
  (`eventsProvider` is `FutureProvider.autoDispose.family`, so each distinct
  `EventsRange` value is a separate provider instance; `ref.invalidate`
  targets exactly one family member, not the family as a whole).
- Because nothing has ever watched *today's* range instance yet, it doesn't
  exist in the container, so `ref.invalidate(eventsProvider(todayRange))` is
  a true no-op — it doesn't even trigger a transient fetch. Same for pull-to
  -refresh's `refreshVisibleData`, which also computes `homeEventsRange()`
  fresh at call time.
- Net effect: once the day rolls over while the app stays foregrounded
  without a pause/resume cycle, the Heute/Demnächst window is stuck on
  yesterday's 8-day span until *some* other trigger forces `HomeScreen` to
  rebuild (a lifecycle pause/resume, a route push/pop, a session-state
  change). `todayProvider`/`todosProvider`/`notesProvider` are unaffected —
  they aren't range-keyed, so the poll refreshes them correctly regardless.

This is a pre-existing latent issue in how `range` is threaded through
`HomeScreen` (the old `_eventsRange()` had the exact same recompute-on-build
shape before this slice), but this slice adds two *new* automatic triggers
(the 30s poll, and resume-invalidation) that both assume invalidating "the
current range" is meaningful without checking it's the same range value the
widget tree is actually watching — so it's now surfaced as a real, if
low-frequency, staleness bug rather than a theoretical one.

## Evidence

```dart
// lib/features/home/home_screen.dart
final EventsRange range = homeEventsRange();   // only recomputed on rebuild
...
_HeuteCard(range: range, l10n: l10n),
_DemnaechstCard(range: range, l10n: l10n),
```

```dart
// lib/state/session_provider.dart
void _pollTick() {
  if (!state.hasSession) return;
  invalidateVisibleHomeProviders(ref.invalidate); // recomputes homeEventsRange() fresh, targets a
}                                                  // possibly-different, possibly-nonexistent family member
```

```dart
// lib/state/events_provider.dart
final AutoDisposeFutureProviderFamily<EventsResult, EventsRange>
    eventsProvider = FutureProvider.autoDispose.family<EventsResult, EventsRange>(...);
```

## Notes

Root cause is really in `home_screen.dart` (pre-existing, not touched
meaningfully by this slice beyond the `_eventsRange()` → `homeEventsRange()`
rename), but the fix belongs with whoever owns the poll/refresh contract
since the natural fix is to make `homeEventsRange()`'s identity change
trigger a `HomeScreen` rebuild — e.g. have `HomeScreen` watch a small
`Provider<EventsRange>` (rebuilt via a day-boundary timer or simply
`ref.watch`ing `todayProvider`-style tick) instead of calling a plain
function inside `build()`. Routing to `mobile-developer` since the fix
touches both `state/data_refresh.dart` (owns `homeEventsRange()`) and
`home_screen.dart`.

Not blocking: doesn't lose data (the 8-day window still covers "today" from
the *stale* start date in all but the last day of its span), doesn't crash,
and self-heals on the next natural rebuild (any backgrounding, or navigating
away and back). Filing as P2 because it's a real, reproducible UI staleness
with no user-facing recovery path (pull-to-refresh doesn't fix it) — not
because it's likely to be hit often given typical phone lock/unlock cycles.

## Fix

Chose **(a)** — a shared, self-rolling range provider — not the wholesale
family-invalidate option (b). Verified (b)'s premise is true in this app's
Riverpod (2.6.1): `ProviderContainer.invalidate` special-cases a bare
`Family` argument and loops `_stateReaders.values` invalidating every
existing member (`riverpod-2.6.1/lib/src/framework/container.dart:290`).
But that only re-triggers a *fetch* for whatever range instance is currently
mounted — it does nothing to fix the actual defect, which is that
`HomeScreen.build()` never recomputes `range` from the wall clock without an
unrelated rebuild trigger. Wholesale-invalidating the family would still
refetch *yesterday's* window forever (drifting further stale every day the
app stays foregrounded), just without the "silent no-op" symptom. (a) fixes
the root cause: the widget's watched value itself now advances at midnight.

**New: `mobile/lib/state/home_range_provider.dart`**
- `MidnightRolloverScheduler` — pure class, schedules a callback for
  1s-past-next-local-midnight, reschedules itself after firing.
  `now`/`timerFactory` injectable for tests (mirrors the
  `ForegroundPollController` pattern from the parent slice).
- `HomeRangeNotifier` / `currentHomeRangeProvider` — a plain
  `NotifierProvider<EventsRange>` (not autoDispose, not a family — exactly
  one instance app-wide). Its `build()` starts the scheduler and returns
  `today → +8d`; on rollover it sets `state` to the new range, which is a
  normal Riverpod state change and therefore a rebuild trigger for anyone
  watching it.

**Changed:**
- `home_screen.dart` — `HomeScreen.build()` now does
  `ref.watch(currentHomeRangeProvider)` instead of calling a plain function.
  A midnight rollover is now itself a `HomeScreen` rebuild, independent of
  any lifecycle event. `_refreshAll()` (pull-to-refresh) reads the same
  provider before calling `refreshVisibleData`.
- `data_refresh.dart` — `visibleHomeProviders`/`invalidateVisibleHomeProviders`/
  `refreshVisibleData` now take `range` as an explicit required parameter
  instead of calling the old (removed) `homeEventsRange()` internally.
  Docblock states the invariant: callers must pass
  `ref.read/watch(currentHomeRangeProvider)`, never recompute independently.
- `session_provider.dart` — `_pollTick()` and `_onResumed()` both now do
  `ref.read(currentHomeRangeProvider)` immediately before invalidating, so
  the poll/resume path is guaranteed to target the exact same `EventsRange`
  instance `HomeScreen` is currently watching (same object, not just
  equal-by-value) — the class of bug in this report becomes structurally
  impossible rather than merely less likely.

**Calendar screen** (`calendar_screen.dart`) — confirmed unaffected by this
class of bug: `_from`/`_to` are `State` fields set once in `initState()` and
only ever changed via explicit `setState()` in `_loadMore()` (user-driven
paging), not recomputed from `DateTime.now()` on every `build()`, and it's
excluded from `visibleHomeProviders()` entirely so the poll never touches
its `eventsProvider` instance. It has its own day-rollover exposure in
principle (if left open across midnight with no paging, `_from` stays
anchored to the day it was opened), but that's a distinct, pre-existing,
lower-severity class — the screen has its own pull-to-refresh and isn't
driven by an unattended background timer. Not fixed here; noting for the
record per the coordinator's ask, not filing a new report since it's
untouched by this slice and self-heals via its own `_refresh()`.

**Tests:** `test/home_range_provider_test.dart` (new) — 4 unit tests on
`MidnightRolloverScheduler` (delay math, single-schedule idempotency, fire
→ callback + reschedule, stop cancels) plus one integration test on
`currentHomeRangeProvider` via `ProviderContainer` + `overrideWith`: sets up
a `container.listen` (the `ref.watch` analog), reads the range (the
`ref.read`/poll analog), fires a simulated midnight rollover, and asserts
the watched and read values are identical both before and after — i.e. the
poll can never target a stale/nonexistent range again.

**Verification:** `flutter analyze` clean (0 issues), `flutter test` —
60/60 passing (55 pre-existing + the parent slice's
`foreground_poll_controller_test.dart`, plus 5 new tests in this fix's
`home_range_provider_test.dart`), `dart format` clean, `dart run
tool/sync_messages.dart` → `OK: 295 keys present in all 4 locales`,
repo-root `tsc --noEmit` clean (wall unaffected).
