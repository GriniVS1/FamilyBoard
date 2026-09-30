// Pins the pair screen's QR-scanner mode against overflow at every size the
// app can land on: classic iPhone portrait and landscape plus the three
// iPhone Duo widths, in all four locales. The caption is 1 line in en and 2-3
// in de/fr/it, which is what broke the earlier fixed-reserve sizing at phone
// landscape heights.

import 'package:familyboard_mobile/features/pair/pair_screen.dart';
import 'package:familyboard_mobile/l10n/generated/app_localizations.dart';
import 'package:familyboard_mobile/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const List<Size> _sizes = <Size>[
  Size(667, 375),
  Size(844, 390),
  Size(932, 430),
  Size(393, 852),
  Size(466, 678),
  Size(626, 890),
  Size(890, 626),
];

Future<void> _pumpScanner(
  WidgetTester tester, {
  required Size size,
  required Locale locale,
  double textScale = 1,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.reset);
  // Fresh element tree per call: PairScreen keeps its mode in State, which
  // would otherwise survive a size / locale change.
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        theme: FamilyBoardTheme.light(),
        locale: locale,
        localizationsDelegates: AppL10n.localizationsDelegates,
        supportedLocales: AppL10n.supportedLocales,
        builder: (BuildContext context, Widget? child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        home: const PairScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
  expect(tester.takeException(), isNull, reason: 'chooser $size');
  await tester.tap(find.byIcon(Icons.qr_code_scanner));
  await tester.pumpAndSettle();
}

void main() {
  group('PairScreen scanner mode', () {
    testWidgets('worst case 667x375 does not overflow (en, de)', (
      WidgetTester tester,
    ) async {
      for (final String code in <String>['en', 'de']) {
        await _pumpScanner(
          tester,
          size: const Size(667, 375),
          locale: Locale(code),
        );
        expect(tester.takeException(), isNull, reason: '667x375 $code');
      }
    });

    testWidgets('no overflow at any size in any locale', (
      WidgetTester tester,
    ) async {
      for (final Size size in _sizes) {
        for (final Locale locale in AppL10n.supportedLocales) {
          await _pumpScanner(tester, size: size, locale: locale);
          expect(
            tester.takeException(),
            isNull,
            reason: '${size.width}x${size.height} ${locale.languageCode}',
          );
        }
      }
    });

    testWidgets('large text (1.3x) at phone landscape does not overflow', (
      WidgetTester tester,
    ) async {
      for (final Locale locale in AppL10n.supportedLocales) {
        await _pumpScanner(
          tester,
          size: const Size(844, 390),
          locale: locale,
          textScale: 1.3,
        );
        expect(
          tester.takeException(),
          isNull,
          reason: '844x390 @1.3 ${locale.languageCode}',
        );
      }
    });

    testWidgets('"enter manually" stays reachable when the body scrolls', (
      WidgetTester tester,
    ) async {
      await _pumpScanner(
        tester,
        size: const Size(667, 375),
        locale: const Locale('de'),
      );

      final Finder manual = find.byIcon(Icons.edit_outlined);
      await tester.ensureVisible(manual);
      await tester.pumpAndSettle();
      expect(manual, findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
