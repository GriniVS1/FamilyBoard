// Pins the adaptive shell at the three iPhone Duo logical widths (466pt cover
// display, 626pt inner display in portrait, 890pt inner display in landscape)
// plus the live fold / unfold resize, where the chrome must swap without
// losing the active tab. Real routes are stubbed with plain text pages so the
// test needs no platform channels.

import 'package:familyboard_mobile/l10n/generated/app_localizations.dart';
import 'package:familyboard_mobile/navigation/app_shell.dart';
import 'package:familyboard_mobile/theme.dart';
import 'package:familyboard_mobile/widgets/adaptive_layout.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

GoRouter _router() {
  StatefulShellBranch branch(String path) => StatefulShellBranch(
    routes: <RouteBase>[
      GoRoute(
        path: path,
        builder: (BuildContext context, GoRouterState state) =>
            Center(child: Text('page $path')),
      ),
    ],
  );
  return GoRouter(
    initialLocation: '/home',
    routes: <RouteBase>[
      StatefulShellRoute.indexedStack(
        builder:
            (
              BuildContext context,
              GoRouterState state,
              StatefulNavigationShell shell,
            ) => AppShell(navigationShell: shell),
        branches: <StatefulShellBranch>[
          branch('/home'),
          branch('/calendar'),
          branch('/meal-plan'),
          branch('/grocery'),
          branch('/more'),
        ],
      ),
    ],
  );
}

Future<void> _pumpShell(
  WidgetTester tester, {
  required Size logicalSize,
  ThemeMode themeMode = ThemeMode.light,
}) async {
  tester.view.devicePixelRatio = 3;
  tester.view.physicalSize = logicalSize * 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp.router(
        theme: FamilyBoardTheme.light(),
        darkTheme: FamilyBoardTheme.dark(),
        themeMode: themeMode,
        localizationsDelegates: const <LocalizationsDelegate<Object>>[
          AppL10n.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppL10n.supportedLocales,
        routerConfig: _router(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('AppShell at iPhone Duo widths', () {
    testWidgets('466x678 cover display -> bottom NavigationBar', (
      WidgetTester tester,
    ) async {
      await _pumpShell(tester, logicalSize: const Size(466, 678));

      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.byType(NavigationRail), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('626x890 inner display portrait -> NavigationRail', (
      WidgetTester tester,
    ) async {
      await _pumpShell(tester, logicalSize: const Size(626, 890));

      expect(find.byType(NavigationRail), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('890x626 inner display landscape -> NavigationRail', (
      WidgetTester tester,
    ) async {
      await _pumpShell(tester, logicalSize: const Size(890, 626));

      expect(find.byType(NavigationRail), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('breakpoint is inclusive at exactly 600pt', (
      WidgetTester tester,
    ) async {
      await _pumpShell(tester, logicalSize: const Size(600, 800));
      expect(find.byType(NavigationRail), findsOneWidget);

      await _pumpShell(tester, logicalSize: const Size(599, 800));
      expect(find.byType(NavigationBar), findsOneWidget);
    });

    testWidgets('rail shows all five labels and tab taps switch branches', (
      WidgetTester tester,
    ) async {
      await _pumpShell(tester, logicalSize: const Size(890, 626));

      final NavigationRail rail = tester.widget(find.byType(NavigationRail));
      expect(rail.destinations, hasLength(5));
      expect(rail.labelType, NavigationRailLabelType.all);
      expect(find.text('page /home'), findsOneWidget);

      await tester.tap(find.byIcon(Icons.calendar_month_outlined));
      await tester.pumpAndSettle();

      expect(find.text('page /calendar'), findsOneWidget);
    });

    testWidgets('rail destinations meet the 48pt touch target', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _pumpShell(tester, logicalSize: const Size(890, 626));

      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      handle.dispose();
    });

    testWidgets('dark theme renders the rail without errors', (
      WidgetTester tester,
    ) async {
      await _pumpShell(
        tester,
        logicalSize: const Size(890, 626),
        themeMode: ThemeMode.dark,
      );

      expect(find.byType(NavigationRail), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('folding and unfolding swaps chrome live and keeps the tab', (
      WidgetTester tester,
    ) async {
      await _pumpShell(tester, logicalSize: const Size(466, 678));
      await tester.tap(find.byIcon(Icons.restaurant_outlined));
      await tester.pumpAndSettle();
      expect(find.text('page /meal-plan'), findsOneWidget);

      // Unfold: resize in place, no re-pump of the widget tree.
      tester.view.physicalSize = const Size(890, 626) * 3;
      await tester.pumpAndSettle();
      expect(find.byType(NavigationRail), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
      expect(find.text('page /meal-plan'), findsOneWidget);
      expect(
        tester
            .widget<NavigationRail>(find.byType(NavigationRail))
            .selectedIndex,
        2,
      );

      // Fold back.
      tester.view.physicalSize = const Size(466, 678) * 3;
      await tester.pumpAndSettle();
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.byType(NavigationRail), findsNothing);
      expect(find.text('page /meal-plan'), findsOneWidget);
    });
  });

  group('AdaptiveLayout', () {
    test('photoColumns steps 2 / 3 / 4 with available width', () {
      expect(AdaptiveLayout.photoColumns(434), 2);
      expect(AdaptiveLayout.photoColumns(519), 2);
      expect(AdaptiveLayout.photoColumns(594), 3);
      expect(AdaptiveLayout.photoColumns(719), 3);
      expect(AdaptiveLayout.photoColumns(858), 4);
    });

    testWidgets('ConstrainedContent caps width at 700 and centres', (
      WidgetTester tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(890, 626);
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        const Directionality(
          textDirection: TextDirection.ltr,
          child: ConstrainedContent(child: SizedBox.expand(key: Key('body'))),
        ),
      );

      final Rect rect = tester.getRect(find.byKey(const Key('body')));
      expect(rect.width, AdaptiveLayout.contentMaxWidth);
      expect(rect.height, 626);
      expect(rect.center.dx, 445);
    });

    testWidgets('ConstrainedContent leaves phone widths untouched', (
      WidgetTester tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(393, 852);
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        const Directionality(
          textDirection: TextDirection.ltr,
          child: ConstrainedContent(child: SizedBox.expand(key: Key('body'))),
        ),
      );

      expect(tester.getRect(find.byKey(const Key('body'))).width, 393);
    });
  });
}
