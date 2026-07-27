// Regression coverage for the bottom-tab shell's staleness mitigation: with
// `StatefulShellRoute.indexedStack`, every branch stays mounted while
// another tab is visible, so a tab's providers are never disposed and never
// refetch on their own. `providersToInvalidateForTab` is what `AppShell`
// calls on every tab switch to force a refetch of the tab being switched
// *to* — this test pins down exactly which providers that is per tab, so a
// future edit can't silently drop a tab from the mapping.

import 'package:familyboard_mobile/navigation/tab_index.dart';
import 'package:familyboard_mobile/navigation/tab_refresh.dart';
import 'package:familyboard_mobile/state/events_provider.dart';
import 'package:familyboard_mobile/state/grocery_provider.dart';
import 'package:familyboard_mobile/state/meal_plan_provider.dart';
import 'package:familyboard_mobile/state/notes_provider.dart';
import 'package:familyboard_mobile/state/today_provider.dart';
import 'package:familyboard_mobile/state/todos_provider.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final EventsRange range = EventsRange(
    from: DateTime(2026, 7, 27),
    to: DateTime(2026, 8, 4),
  );

  group('providersToInvalidateForTab', () {
    test('Heute invalidates the full visible-home-provider set', () {
      final List<Object> providers =
          providersToInvalidateForTab(homeTabIndex, range);

      expect(
          providers,
          containsAll(<Object>[
            eventsProvider(range),
            todayProvider,
            todosProvider,
            notesProvider,
          ]));
    });

    test('Kalender invalidates the eventsProvider family as a whole', () {
      final List<Object> providers =
          providersToInvalidateForTab(calendarTabIndex, range);

      expect(providers, equals(<Object>[eventsProvider]));
    });

    test('Essensplan invalidates mealPlanProvider', () {
      final List<Object> providers =
          providersToInvalidateForTab(mealPlanTabIndex, range);

      expect(providers, equals(<Object>[mealPlanProvider]));
    });

    test('Einkauf invalidates groceryProvider', () {
      final List<Object> providers =
          providersToInvalidateForTab(groceryTabIndex, range);

      expect(providers, equals(<Object>[groceryProvider]));
    });

    test('Mehr has no primary data of its own to refresh', () {
      final List<Object> providers =
          providersToInvalidateForTab(moreTabIndex, range);

      expect(providers, isEmpty);
    });

    test('an out-of-range index is a safe no-op', () {
      final List<Object> providers = providersToInvalidateForTab(99, range);

      expect(providers, isEmpty);
    });
  });
}
