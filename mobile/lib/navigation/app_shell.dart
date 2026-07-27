import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../l10n/generated/app_localizations.dart';
import '../state/events_provider.dart';
import '../state/home_range_provider.dart';
import 'tab_refresh.dart';

/// Bottom-tab shell for the 5 signed-in-only branches: Heute, Kalender,
/// Essensplan, Einkauf, Mehr.
///
/// Each branch keeps its own Navigator and back-stack
/// (`StatefulShellRoute.indexedStack` in `app.dart`), so switching tabs
/// never loses in-branch navigation state. Full-screen flows that should
/// cover the tab bar (Notes, Photos, Settings, and the various edit sheets)
/// are declared as top-level routes outside this shell instead of nested
/// branch routes, so they push onto the root navigator and naturally
/// obscure this Scaffold's `bottomNavigationBar`.
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.navigationShell});

  /// Gives access to the state of the shell and lets the bottom bar
  /// navigate to other branches without losing their state.
  final StatefulNavigationShell navigationShell;

  void _onDestinationSelected(WidgetRef ref, int index) {
    if (index != navigationShell.currentIndex) {
      final EventsRange homeRange = ref.read(currentHomeRangeProvider);
      for (final ProviderOrFamily provider
          in providersToInvalidateForTab(index, homeRange)) {
        ref.invalidate(provider);
      }
    }
    navigationShell.goBranch(
      index,
      // Tapping the already-active tab pops back to its initial location —
      // the iOS-typical "tap again to go to top" affordance.
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppL10n l10n = AppL10n.of(context);
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (int index) =>
            _onDestinationSelected(ref, index),
        destinations: <NavigationDestination>[
          NavigationDestination(
            icon: const Icon(Icons.space_dashboard_outlined),
            selectedIcon: const Icon(Icons.space_dashboard),
            label: l10n.homeTodayCard,
          ),
          NavigationDestination(
            icon: const Icon(Icons.calendar_month_outlined),
            selectedIcon: const Icon(Icons.calendar_month),
            label: l10n.calendarTitle,
          ),
          NavigationDestination(
            icon: const Icon(Icons.restaurant_outlined),
            selectedIcon: const Icon(Icons.restaurant),
            label: l10n.mealPlanTitle,
          ),
          NavigationDestination(
            icon: const Icon(Icons.shopping_cart_outlined),
            selectedIcon: const Icon(Icons.shopping_cart),
            label: l10n.groceryTitle,
          ),
          NavigationDestination(
            icon: const Icon(Icons.more_horiz),
            label: l10n.moreTitle,
          ),
        ],
      ),
    );
  }
}
