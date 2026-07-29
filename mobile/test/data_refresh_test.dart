// Pins down the two refresh scopes in `state/data_refresh.dart`:
// - `visibleHomeProviders` — Home screen's own pull-to-refresh, narrowly
//   scoped to what Home displays.
// - `allDataProviders` — the 30s foreground poll / post-resume refresh,
//   which must cover every screen the app shows, not just Home. A future
//   edit that silently drops a provider from this list would reintroduce
//   the "page sits stale until pull-to-refresh" field bug this list fixes.

import 'package:familyboard_mobile/state/chores_provider.dart';
import 'package:familyboard_mobile/state/data_refresh.dart';
import 'package:familyboard_mobile/state/events_provider.dart';
import 'package:familyboard_mobile/state/grocery_provider.dart';
import 'package:familyboard_mobile/state/meal_plan_provider.dart';
import 'package:familyboard_mobile/state/notes_provider.dart';
import 'package:familyboard_mobile/state/photos_provider.dart';
import 'package:familyboard_mobile/state/today_provider.dart';
import 'package:familyboard_mobile/state/todos_provider.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderOrFamily;
import 'package:flutter_test/flutter_test.dart';

void main() {
  final EventsRange range = EventsRange(
    from: DateTime(2026, 7, 27),
    to: DateTime(2026, 8, 4),
  );

  group('visibleHomeProviders', () {
    test('is exactly Home\'s always-visible cards', () {
      final List<Object> providers = visibleHomeProviders(range);

      expect(
        providers,
        equals(<Object>[
          eventsProvider(range),
          todayProvider,
          todosProvider,
          notesProvider,
        ]),
      );
    });
  });

  group('allDataProviders', () {
    test('covers every screen the app shows', () {
      final List<Object> providers = allDataProviders();

      expect(
        providers,
        equals(<Object>[
          eventsProvider,
          todayProvider,
          todosProvider,
          notesProvider,
          choresProvider,
          groceryProvider,
          mealPlanProvider,
          photosProvider,
        ]),
      );
    });

    test('invalidates the eventsProvider family as a whole, not a range', () {
      // The poll must not target a specific EventsRange — see
      // data_refresh.dart's doc comment: invalidating the family covers
      // both Home's range and Calendar's own, independently of either.
      final List<Object> providers = allDataProviders();

      expect(providers, contains(eventsProvider));
      expect(providers, isNot(contains(eventsProvider(range))));
    });
  });

  group('invalidateAllDataProviders', () {
    test('invalidates every provider in allDataProviders exactly once', () {
      final List<ProviderOrFamily> invalidated = <ProviderOrFamily>[];

      invalidateAllDataProviders(invalidate: invalidated.add);

      expect(invalidated, equals(allDataProviders()));
    });
  });
}
