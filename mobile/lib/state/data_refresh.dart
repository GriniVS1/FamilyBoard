// Single source of truth for two related-but-distinct refresh scopes:
//
// 1. [visibleHomeProviders] / [refreshVisibleData] — exactly what the Home
//    screen shows (Heute/Demnächst, Ämtli, To-dos, Notizen). Backs Home's own
//    `RefreshIndicator` (`home_screen.dart`'s `_refreshAll`), which needs a
//    narrow, awaitable set so the spinner stops when *that screen's* cards
//    are done, not when unrelated screens finish.
// 2. [allDataProviders] / [invalidateAllDataProviders] — every data provider
//    the app shows anywhere. Backs the 30s foreground poll and the
//    post-resume refresh, both in `SessionNotifier` (`session_provider.dart`,
//    `_pollTick` / `_onResumed`). Field feedback: a family member could leave
//    the grocery list open in the store while someone else added items on
//    the wall, and nothing appeared until a manual pull-to-refresh — the
//    30s poll must cover every screen, not just Home.
//
// Every screen's own pull-to-refresh (Tasks, Grocery, Photos, Calendar, ...)
// stays independently wired to its own provider(s) in its own file — this
// file does not try to centralize those, only the two scopes above.

import 'package:flutter_riverpod/misc.dart'
    show ProviderListenable, ProviderOrFamily;

import 'chores_provider.dart';
import 'events_provider.dart';
import 'grocery_provider.dart';
import 'meal_plan_provider.dart';
import 'notes_provider.dart';
import 'photos_provider.dart';
import 'today_provider.dart';
import 'todos_provider.dart';

// ---------------------------------------------------------------------------
// Home screen scope — pull-to-refresh only
// ---------------------------------------------------------------------------

/// Providers backing the home screen's always-visible cards: Heute /
/// Demnächst (the `eventsProvider` family member for [range]), Chores
/// (`todayProvider`), Todos, and Notizen.
///
/// [range] must be the exact value the home screen is currently watching —
/// pass `ref.read(currentHomeRangeProvider)` / `ref.watch(...)` (see
/// `home_range_provider.dart`), never recompute "today through +8 days"
/// independently from `DateTime.now()`. `eventsProvider` is an autoDispose
/// family keyed by `EventsRange` value equality: invalidating a *different*
/// range value than the one actually mounted is a silent no-op — see bug
/// report
/// `2026-07-27T04-40-06-foreground-poll-misses-midnight-range-rollover.md`.
List<ProviderOrFamily> visibleHomeProviders(EventsRange range) {
  return <ProviderOrFamily>[
    eventsProvider(range),
    todayProvider,
    todosProvider,
    notesProvider,
  ];
}

/// Invalidates [visibleHomeProviders]. Cheap and fire-and-forget: Riverpod
/// providers refetch lazily the next time something watches them, so this is
/// safe to call even when the home screen isn't the visible route — it's a
/// no-op until something reads the provider again.
void invalidateVisibleHomeProviders({
  required EventsRange range,
  required void Function(ProviderOrFamily provider) invalidate,
}) {
  for (final ProviderOrFamily provider in visibleHomeProviders(range)) {
    invalidate(provider);
  }
}

/// Invalidates [visibleHomeProviders] and awaits every refetch — used by
/// Home's pull-to-refresh, where `RefreshIndicator` needs a future to know
/// when to stop spinning. Each fetch is awaited independently so one
/// slow/failing card doesn't block the others from refreshing.
///
/// Each refresh is a real network round trip per provider (4 GETs here). On
/// LAN that's negligible; over the relay it's also well inside the mobile
/// rate limit (120 req/min/installation).
Future<void> refreshVisibleData({
  required EventsRange range,
  required void Function(ProviderOrFamily provider) invalidate,
  required T Function<T>(ProviderListenable<T> provider) read,
}) async {
  invalidateVisibleHomeProviders(range: range, invalidate: invalidate);

  final List<Future<void>> pending = <Future<void>>[
    read(eventsProvider(range).future).then((_) {}),
    read(todayProvider.future).then((_) {}),
    read(todosProvider.future).then((_) {}),
    read(notesProvider.future).then((_) {}),
  ];
  for (final Future<void> f in pending) {
    try {
      await f;
    } catch (_) {}
  }
}

// ---------------------------------------------------------------------------
// App-wide scope — 30s foreground poll + post-resume refresh
// ---------------------------------------------------------------------------

/// Every provider backing a screen the app can show: Heute/Demnächst
/// (`eventsProvider`, invalidated as a whole family — see below), Ämtli
/// (`todayProvider` for Home's member-scoped view, `choresProvider` for the
/// Tasks screen's family-wide view), Todos, Notizen, Einkauf, Essensplan and
/// Fotos.
///
/// `eventsProvider` is listed as the **family itself**, not a specific
/// `eventsProvider(range)` member: `ProviderContainer.invalidate` on a
/// `Family` invalidates every currently-materialized member of that family
/// (riverpod 3.4.1, `lib/src/core/provider_container.dart`:
/// `case Family(): for (final element in _pointerManager.listFamily(provider))
/// { element.invalidateSelf(...) }`). One entry therefore covers both Home's
/// `EventsRange` (Heute/Demnächst) and whatever window `CalendarScreen`
/// currently has open, without the poll needing to read either range — this
/// is the same pattern already used by `event_edit_sheet.dart` /
/// `event_detail_sheet.dart` after a write.
///
/// Riverpod semantics this whole function relies on (riverpod 3.4.1):
/// - `ProviderContainer.invalidate` only *marks* a provider dirty and
///   schedules it via `ProviderScheduler.scheduleProviderRefresh`
///   (`core/element.dart`'s `invalidateSelf`). The scheduler's doc comment
///   states the refresh "will happen at the end of the next event-loop, and
///   only if the provider is active" (`core/scheduler.dart`), and
///   `_performRefresh` enforces exactly that: `if (element.isActive)
///   element.flush();`. `isActive` is `listenerCount > 0` — a listener-count
///   check, **not** an autoDispose check — so invalidating *any* provider
///   (autoDispose or plain/keepAlive, which every provider in this list
///   except `eventsProvider` is) with zero current listeners costs nothing:
///   no rebuild, no network call. The pending invalidation is simply
///   fulfilled the next time something reads/watches the provider (`flush()`
///   also runs on read/listen, per its own doc comment), so nothing is
///   silently lost either.
/// - Tab-shell providers stay active across every poll tick regardless of
///   which tab is on screen: `StatefulShellRoute.indexedStack` keeps every
///   branch mounted once visited (`tab_refresh.dart`'s header comment), so
///   `todayProvider`, `todosProvider`, `notesProvider`, `groceryProvider`,
///   `mealPlanProvider`, and `eventsProvider`'s Home + Calendar range
///   instances all keep a live listener and refetch on every tick — this is
///   exactly the field-reported gap (a family member leaves the grocery tab
///   open while someone else edits the list on the wall).
/// - `choresProvider` (Tasks screen) and `photosProvider` (Photos screen)
///   are reached via `context.push('/tasks')` / `context.push('/photos')` —
///   plain pushed routes, not tabs — so they are only watched while that
///   screen is on top of the navigator stack. Per the point above, polling
///   them while the screen is closed is a no-op (not a wasted request), and
///   reopening the screen fetches fresh data immediately rather than
///   showing whatever was cached from before the poll.
///
/// Worst case, every provider here is simultaneously active (both an
/// Heute/Demnächst `EventsRange` *and* Calendar's own window mounted) — 9
/// GETs/30s ≈ 18 req/min, still far under the relay's 120 req/min/
/// installation cap; on LAN it's irrelevant.
List<ProviderOrFamily> allDataProviders() {
  return <ProviderOrFamily>[
    eventsProvider,
    todayProvider,
    todosProvider,
    notesProvider,
    choresProvider,
    groceryProvider,
    mealPlanProvider,
    photosProvider,
  ];
}

/// Invalidates [allDataProviders]. Fire-and-forget, same contract as
/// [invalidateVisibleHomeProviders] — safe to call unconditionally from the
/// 30s poll and the post-resume hook no matter which tab/screen is currently
/// on top; see [allDataProviders] for why inactive providers cost nothing.
void invalidateAllDataProviders({
  required void Function(ProviderOrFamily provider) invalidate,
}) {
  for (final ProviderOrFamily provider in allDataProviders()) {
    invalidate(provider);
  }
}
