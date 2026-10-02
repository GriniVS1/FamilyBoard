// The star counter pulses once and must settle back to exactly 1.0
// (regression: the old sine curve ended at 1.3 and stayed enlarged).

import 'package:familyboard_mobile/kids/kid_stars.dart';
import 'package:familyboard_mobile/kids/points.dart';
import 'package:familyboard_mobile/l10n/generated/app_localizations.dart';
import 'package:familyboard_mobile/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _host(int value, {required bool reduced}) {
  return MaterialApp(
    theme: FamilyBoardTheme.light(),
    locale: const Locale('de'),
    localizationsDelegates: const <LocalizationsDelegate<Object>>[
      AppL10n.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppL10n.supportedLocales,
    builder: (BuildContext context, Widget? child) => MediaQuery(
      data: MediaQuery.of(context).copyWith(disableAnimations: reduced),
      child: child!,
    ),
    home: Scaffold(
      body: Center(
        child: KidStarCounter(
          count: StarCount(value: value, scope: StarScope.today),
          name: 'Mia',
        ),
      ),
    ),
  );
}

double _scale(WidgetTester tester) {
  final ScaleTransition t = tester.widget(
    find.descendant(
      of: find.byType(KidStarCounter),
      matching: find.byType(ScaleTransition),
    ),
  );
  return t.scale.value;
}

void main() {
  testWidgets('pulses up and settles back to exactly 1.0', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(_host(2, reduced: false));
    expect(_scale(tester), 1.0);

    await tester.pumpWidget(_host(5, reduced: false));
    double peak = 1.0;
    for (int i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 42));
      if (_scale(tester) > peak) {
        peak = _scale(tester);
      }
    }
    expect(peak, greaterThan(1.2));
    expect(peak, lessThanOrEqualTo(1.3));

    await tester.pump(const Duration(milliseconds: 600));
    expect(_scale(tester), 1.0);
    await tester.pump(const Duration(seconds: 3));
    expect(_scale(tester), 1.0);
    expect(find.text('5'), findsOneWidget);
  });

  testWidgets('a second increase also ends at 1.0', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(_host(2, reduced: false));
    await tester.pumpWidget(_host(5, reduced: false));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pumpWidget(_host(6, reduced: false));
    await tester.pump(const Duration(seconds: 1));
    expect(_scale(tester), 1.0);
  });

  testWidgets('reduced motion: no pulse at all, scale stays 1.0', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(_host(2, reduced: true));
    await tester.pumpWidget(_host(5, reduced: true));
    for (int i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 50));
      expect(_scale(tester), 1.0);
    }
    await tester.pump(const Duration(seconds: 2));
    expect(_scale(tester), 1.0);
    expect(find.text('5'), findsOneWidget);
  });
}
