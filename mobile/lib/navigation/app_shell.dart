import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderOrFamily;
import 'package:go_router/go_router.dart';

import '../kids/undo_toast.dart';
import '../l10n/generated/app_localizations.dart';
import '../state/events_provider.dart';
import '../state/home_range_provider.dart';
import '../widgets/adaptive_layout.dart';
import 'kid_nav.dart';
import 'tab_refresh.dart';

/// Tab shell for the 5 signed-in-only branches: Heute, Aufgaben, Kalender,
/// Essen, Mehr (R7). Kid areas come first; Einkauf, To-dos, Notizen, Fotos and
/// Einstellungen live behind Mehr.
///
/// The undo toast host sits on top of the content, directly above the bottom
/// bar (or above the bottom edge of the content in the rail layout), so a
/// toast survives tab switches (R5.2).
///
/// Below [AdaptiveLayout.railBreakpoint] (600pt) the tabs are a bottom
/// NavigationBar; at or above it (iPhone Duo inner display, phones in
/// landscape, tablets) they become a left NavigationRail with visible
/// labels. The width is read from MediaQuery in `build`, so folding or
/// unfolding a Duo swaps the chrome live. The go_router branch navigators
/// live in [navigationShell] and survive the swap.
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
      for (final ProviderOrFamily provider in providersToInvalidateForTab(
        index,
        homeRange,
      )) {
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
    final List<KidNavDestinationSpec> tabs = kidNavDestinations(l10n);

    if (!AdaptiveLayout.useRail(context)) {
      return Scaffold(
        body: _withToasts(navigationShell),
        bottomNavigationBar: NavigationBar(
          selectedIndex: navigationShell.currentIndex,
          labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
          indicatorColor: Colors.transparent,
          onDestinationSelected: (int index) =>
              _onDestinationSelected(ref, index),
          destinations: <NavigationDestination>[
            for (final KidNavDestinationSpec tab in tabs)
              NavigationDestination(
                icon: KidNavIcon(spec: tab),
                selectedIcon: KidNavPill(spec: tab),
                label: tab.label,
              ),
          ],
        ),
      );
    }

    final ColorScheme scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: Row(
        children: <Widget>[
          // The rail owns the leading (notch / rounded-corner) inset, so the
          // screens to its right must not inset for it a second time.
          ColoredBox(
            color: scheme.surface,
            child: SafeArea(
              right: false,
              child: LayoutBuilder(
                builder: (BuildContext context, BoxConstraints constraints) {
                  // Rail + scroll recipe: a phone in landscape is ~390pt tall,
                  // barely enough for five labelled destinations.
                  return SingleChildScrollView(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        minHeight: constraints.maxHeight,
                      ),
                      child: IntrinsicHeight(
                        child: NavigationRail(
                          labelType: NavigationRailLabelType.selected,
                          useIndicator: false,
                          selectedIndex: navigationShell.currentIndex,
                          onDestinationSelected: (int index) =>
                              _onDestinationSelected(ref, index),
                          destinations: <NavigationRailDestination>[
                            for (final KidNavDestinationSpec tab in tabs)
                              NavigationRailDestination(
                                icon: KidNavIcon(spec: tab),
                                selectedIcon: KidNavPill(spec: tab),
                                label: Text(tab.label),
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          VerticalDivider(width: 1, thickness: 1, color: scheme.outline),
          Expanded(
            child: MediaQuery.removePadding(
              context: context,
              removeLeft: true,
              child: _withToasts(navigationShell),
            ),
          ),
        ],
      ),
    );
  }
}

/// Content with the undo toasts stacked on its bottom edge.
Widget _withToasts(Widget content) {
  return Stack(
    children: <Widget>[
      Positioned.fill(child: content),
      const Positioned(left: 0, right: 0, bottom: 0, child: UndoToastHost()),
    ],
  );
}
