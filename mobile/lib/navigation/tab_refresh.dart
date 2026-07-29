// Mitigates a staleness regression introduced by the bottom-tab shell's
// `StatefulShellRoute.indexedStack`: every branch stays mounted (just not
// visible) while another tab is active, so its providers are never disposed
// and never re-fetch on the old "push → pop → dispose → refetch on next
// push" cadence autoDispose used to give screens reached via `context.push`.
// Riverpod providers don't know a tab switch happened, so without this,
// Kalender/Essensplan/Einkauf could sit on data fetched minutes ago the next
// time their tab becomes visible.
//
// Fix: `AppShell` calls [providersToInvalidateForTab] on every
// `onDestinationSelected` and invalidates each entry before switching. Cheap
// — invalidation is a no-op until something re-reads the provider — and
// targeted: only the tab actually being switched *to* gets refreshed, not
// every branch on every switch.
//
// Since the 30s foreground poll now also covers every tab's data (see
// `data_refresh.dart`'s `allDataProviders`), this on-switch invalidation is
// technically redundant within any given 30s window — but it's kept: it's
// what makes a tab switch feel instant (no stale frame while waiting for the
// next tick) rather than "eventually consistent within 30s", and it's a
// single cheap invalidate call, not worth removing for that.
import 'package:flutter_riverpod/misc.dart' show ProviderOrFamily;

import '../state/data_refresh.dart';
import '../state/events_provider.dart';
import '../state/grocery_provider.dart';
import '../state/meal_plan_provider.dart';
import 'tab_index.dart';

/// The providers backing the primary data of the tab at [tabIndex].
///
/// [homeRange] must be `ref.read(currentHomeRangeProvider)` — see
/// `data_refresh.dart` for why the Heute/Demnächst window must always be
/// read, never recomputed, from that single source of truth.
///
/// - Heute reuses [visibleHomeProviders] (Heute/Demnächst events, chores,
///   todos, notes — the same set the pull-to-refresh and foreground poll
///   already cover).
/// - Kalender invalidates the whole `eventsProvider` family (no args) —
///   `CalendarScreen` owns its own date-window state, so there is no single
///   `EventsRange` instance to target; invalidating the family invalidates
///   whichever range instance it currently has mounted.
/// - Essensplan / Einkauf are plain (non-family, non-autoDispose)
///   `FutureProvider`s, so a bare invalidate is enough.
/// - Mehr has no data of its own — it's a navigation list.
List<ProviderOrFamily> providersToInvalidateForTab(
  int tabIndex,
  EventsRange homeRange,
) {
  switch (tabIndex) {
    case homeTabIndex:
      return visibleHomeProviders(homeRange);
    case calendarTabIndex:
      return <ProviderOrFamily>[eventsProvider];
    case mealPlanTabIndex:
      return <ProviderOrFamily>[mealPlanProvider];
    case groceryTabIndex:
      return <ProviderOrFamily>[groceryProvider];
    case moreTabIndex:
      return const <ProviderOrFamily>[];
    default:
      return const <ProviderOrFamily>[];
  }
}
