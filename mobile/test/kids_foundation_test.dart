// Tokens, theme wiring and the KidPicto widget.

import 'dart:convert';
import 'dart:io';

import 'package:familyboard_mobile/kids/kid_theme.dart';
import 'package:familyboard_mobile/kids/picto.dart';
import 'package:familyboard_mobile/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';

Color _hex(String hex) =>
    Color(0xFF000000 | int.parse(hex.substring(1), radix: 16));

void main() {
  final Map<String, Object?> tokens =
      ((jsonDecode(File('assets/kids/tokens.json').readAsStringSync())
                  as Map<Object?, Object?>)['tokens']!
              as Map<Object?, Object?>)
          .cast<String, Object?>();

  group('KidTokens', () {
    test('exposes all 62 tokens, light and dark, matching tokens.json', () {
      expect(tokens.length, 62);
      final Map<String, Color> light = KidTokens.light.asMap();
      final Map<String, Color> dark = KidTokens.dark.asMap();
      expect(light.keys.toSet(), tokens.keys.toSet());
      expect(dark.keys.toSet(), tokens.keys.toSet());
      for (final MapEntry<String, Object?> e in tokens.entries) {
        final Map<Object?, Object?> v = e.value! as Map<Object?, Object?>;
        expect(light[e.key], _hex(v['light']! as String), reason: e.key);
        expect(dark[e.key], _hex(v['dark']! as String), reason: e.key);
      }
    });

    test('accent() resolves tint/ink triples and falls back to sky', () {
      final KidAccent peach = KidTokens.light.accent('peach');
      expect(peach.base, KidTokens.light.accentPeach);
      expect(peach.tint, KidTokens.light.accentPeachTint);
      expect(peach.ink, KidTokens.light.accentPeachInk);
      expect(KidTokens.light.accent('PEACH').base, peach.base);
      expect(KidTokens.light.accent(null).base, KidTokens.light.accentSky);
      expect(KidTokens.light.accent('nope').base, KidTokens.light.accentSky);
      expect(KidTokens.accentNames.length, 8);
      for (final String name in KidTokens.accentNames) {
        expect(KidTokens.dark.accent(name).base, isNot(Colors.transparent));
      }
    });

    test('lerp and copyWith keep the extension consistent', () {
      final KidTokens mid = KidTokens.light.lerp(KidTokens.dark, 0.5);
      expect(mid.bg, Color.lerp(KidTokens.light.bg, KidTokens.dark.bg, 0.5));
      expect(KidTokens.light.lerp(null, 0.5), same(KidTokens.light));
      expect(KidTokens.light.copyWith(bg: Colors.red).bg, Colors.red);
    });

    test('is wired into the light and dark ThemeData', () {
      expect(
        FamilyBoardTheme.light().extension<KidTokens>(),
        same(KidTokens.light),
      );
      expect(
        FamilyBoardTheme.dark().extension<KidTokens>(),
        same(KidTokens.dark),
      );
    });
  });

  group('kid type scale (R2.1)', () {
    test('sizes, line heights and weights', () {
      void expectStyle(TextStyle s, double size, double line, FontWeight w) {
        expect(s.fontSize, size);
        expect(s.fontSize! * s.height!, closeTo(line, 0.001));
        expect(s.fontWeight, w);
        expect(s.fontSize, greaterThanOrEqualTo(14));
      }

      expectStyle(KidText.label, 14, 20, FontWeight.w600);
      expectStyle(KidText.body, 16, 24, FontWeight.w500);
      expectStyle(KidText.title, 18, 24, FontWeight.w600);
      expectStyle(KidText.titleLg, 20, 28, FontWeight.w600);
      expectStyle(KidText.heading, 28, 36, FontWeight.w600);
      expect(KidText.number.fontSize, 24);
      expect(KidText.number.fontWeight, FontWeight.w700);
      expect(
        KidText.number.fontFeatures,
        contains(const FontFeature.tabularFigures()),
      );
    });

    test('radii (R2.3)', () {
      expect(KidRadius.group, 32);
      expect(KidRadius.card, 24);
      expect(KidRadius.pictoTile, 16);
    });
  });

  group('KidPicto', () {
    testWidgets('renders the theme-matching SVG and is decorative by default', (
      WidgetTester tester,
    ) async {
      for (final ThemeData theme in <ThemeData>[
        FamilyBoardTheme.light(),
        FamilyBoardTheme.dark(),
      ]) {
        await tester.pumpWidget(
          MaterialApp(
            theme: theme,
            home: const Center(child: KidPicto('water')),
          ),
        );
        await tester.pump();
        final SvgPicture svg = tester.widget<SvgPicture>(
          find.byType(SvgPicture),
        );
        expect(svg.width, KidPictoSize.card);
        expect(svg.height, KidPictoSize.card);
        expect(svg.excludeFromSemantics, isTrue);
        expect(
          KidPicto.assetPath('water', theme.brightness),
          'assets/kids/pictos/${theme.brightness.name}/water.svg',
        );
      }
    });

    testWidgets('exposes a label only when asked', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: FamilyBoardTheme.light(),
          home: const Center(
            child: KidPicto('oops', semanticLabel: 'Fehler', size: 96),
          ),
        ),
      );
      await tester.pump();
      final SvgPicture svg = tester.widget<SvgPicture>(find.byType(SvgPicture));
      expect(svg.excludeFromSemantics, isFalse);
      expect(svg.semanticsLabel, 'Fehler');
    });
  });

  testWidgets('KidPressable shifts 2px down when pressed', (
    WidgetTester tester,
  ) async {
    Future<Offset> topLeft({required bool pressed}) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: FamilyBoardTheme.light(),
          home: Align(
            alignment: Alignment.topLeft,
            child: KidPressable(
              color: Colors.white,
              pressed: pressed,
              child: const SizedBox(key: Key('c'), width: 40, height: 40),
            ),
          ),
        ),
      );
      return tester.getTopLeft(find.byKey(const Key('c')));
    }

    final Offset rest = await topLeft(pressed: false);
    final Offset down = await topLeft(pressed: true);
    expect(down.dy - rest.dy, kKidPressDepth);
  });
}
