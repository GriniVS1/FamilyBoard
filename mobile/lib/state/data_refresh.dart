// Single source of truth for "what counts as visible home-screen data" and
// how it gets refreshed. Pull-to-refresh (home_screen), the post-resume
// refresh, and the 30s foreground poll (both in SessionNotifier) all funnel
// through this file so there is exactly one list to keep in sync.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'events_provider.dart';
import 'notes_provider.dart';
import 'today_provider.dart';
import 'todos_provider.dart';

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
///
/// Deliberately excluded:
/// - Grocery / meal-plan / photos providers — only relevant while their own
///   screen is open; those screens fetch fresh data on push and have their
///   own pull-to-refresh. Polling them from the home screen would burn
///   battery/requests for data nobody is looking at.
/// - The calendar screen's own `eventsProvider` range — it owns its own
///   date-window state (`_from`/`_to` fields, extended via explicit
///   "load more" paging) and its own pull-to-refresh; it isn't part of the
///   home screen's always-visible surface.
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
/// pull-to-refresh, where `RefreshIndicator` needs a future to know when to
/// stop spinning. Each fetch is awaited independently so one slow/failing
/// card doesn't block the others from refreshing.
///
/// Each refresh is a real network round trip per provider (4 GETs here). On
/// LAN that's negligible; over the relay it's also well inside the mobile
/// rate limit (120 req/min/installation) — the 30s foreground poll adds at
/// most ~8 req/30s, far below the cap.
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
