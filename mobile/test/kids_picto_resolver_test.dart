// Parity of the Dart picto resolver with the wall's TypeScript resolver:
// every case of resolve-fixtures.json must match exactly, and the generated
// catalog / ported emoji table must not drift from the handoff manifest.

import 'dart:convert';
import 'dart:io';

import 'package:familyboard_mobile/kids/emoji_map.dart';
import 'package:familyboard_mobile/kids/picto_catalog.g.dart';
import 'package:familyboard_mobile/kids/picto_resolver.dart';
import 'package:familyboard_mobile/kids/picto_suggest.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, Object?> _json(String path) =>
    (jsonDecode(File(path).readAsStringSync()) as Map<Object?, Object?>)
        .cast<String, Object?>();

typedef FixtureCase = ({String? icon, String title, String? expected});

List<FixtureCase> _cases(Map<String, Object?> fixtures, String key) {
  return <FixtureCase>[
    for (final Object? entry in fixtures[key]! as List<Object?>)
      _toCase((entry! as Map<Object?, Object?>).cast<String, Object?>()),
  ];
}

FixtureCase _toCase(Map<String, Object?> raw) => (
  icon: raw['icon'] as String?,
  title: raw['title']! as String,
  expected: raw['expected'] as String?,
);

void main() {
  final Map<String, Object?> fixtures = _json(
    'test/fixtures/resolve-fixtures.json',
  );
  final Map<String, Object?> manifest = _json(
    'assets/kids/pictos-manifest.json',
  );

  group('resolve-fixtures.json parity', () {
    final List<FixtureCase> taskCases = _cases(fixtures, 'task');
    final List<FixtureCase> eventCases = _cases(fixtures, 'event');

    test('fixture file has the expected size', () {
      expect(taskCases.length + eventCases.length, 62);
    });

    for (final FixtureCase c in taskCases) {
      test('task: ${c.icon} | ${c.title} -> ${c.expected}', () {
        expect(resolveTaskPicto(c.icon, c.title), c.expected);
      });
    }
    for (final FixtureCase c in eventCases) {
      test('event: ${c.icon} | ${c.title} -> ${c.expected}', () {
        expect(resolveEventPicto(c.icon, c.title), c.expected);
      });
    }
  });

  group('resolution order (R3.2)', () {
    test('explicit name beats everything, with or without prefix', () {
      expect(resolveTaskPicto('water', 'Zähne putzen'), 'water');
      expect(resolveTaskPicto('picto:water', 'Zähne putzen'), 'water');
    });

    test('explicit name of the wrong category is ignored', () {
      expect(resolveTaskPicto('event-school', 'Wasser trinken'), 'water');
      expect(resolveEventPicto('water', 'Schule'), 'event-school');
    });

    test('nav / time motifs never appear on cards', () {
      expect(resolveTaskPicto('nav-home', 'Irgendwas'), isNull);
      expect(resolveTaskPicto('tod-evening', 'Irgendwas'), isNull);
      expect(resolveTaskPicto('🌙', 'Irgendwas'), isNull);
    });

    test('specific title keyword beats the emoji', () {
      expect(resolveTaskPicto('📚', 'Hausaufgaben'), 'homework');
    });

    test('weak keyword loses to an emoji of the category', () {
      expect(resolveTaskPicto('🐱', 'Tiere füttern'), 'feed-cat');
      expect(resolveTaskPicto(null, 'Katze füttern'), 'feed-cat');
      expect(resolveTaskPicto(null, 'füttern'), 'feed-dog');
    });

    test('emoji with variation selector and skin tone normalises', () {
      expect(resolveTaskPicto('🛏️', 'x'), 'make-bed');
      expect(resolveTaskPicto('🛏', 'x'), 'make-bed');
    });

    test('null icon and empty title yield null', () {
      expect(resolveTaskPicto(null, ''), isNull);
      expect(resolveEventPicto('  ', '  '), isNull);
    });

    test('diacritics fold like NFD: Zähne, Café-style input', () {
      expect(normalizeTitle('Zähne putzen!'), 'zahne putzen');
      expect(normalizeTitle('Straße'), 'strasse');
      expect(normalizeTitle('Crème brûlée'), 'creme brulee');
      expect(normalizeTitle('Zähne'), 'zahne');
    });

    test('compat resolver: emoji beats title', () {
      expect(resolvePicto('🛏️', 'Zähne putzen'), 'make-bed');
      expect(resolvePicto(null, 'Zähne putzen'), 'teeth');
    });
  });

  group('canonical emoji (R3.3)', () {
    test('canonicalEmojiFor returns the manifest emoji', () {
      expect(canonicalEmojiFor('water'), '💧');
      expect(canonicalEmojiFor('teeth'), '🪥');
      expect(canonicalEmojiFor('nope'), isNull);
    });

    test(
      'every task motif round-trips: canonical emoji resolves to itself',
      () {
        for (final PictoMeta m in pictosOfCategory(PictoCategory.task)) {
          expect(
            resolveTaskPicto(m.emoji, ''),
            m.name,
            reason: '${m.name} (${m.emoji})',
          );
        }
      },
    );

    test('every event motif round-trips', () {
      for (final PictoMeta m in pictosOfCategory(PictoCategory.event)) {
        expect(
          resolveEventPicto(m.emoji, ''),
          m.name,
          reason: '${m.name} (${m.emoji})',
        );
      }
    });
  });

  group('handoff drift guards', () {
    final List<Map<String, Object?>> pictos =
        (manifest['pictos']! as List<Object?>)
            .map(
              (Object? e) =>
                  (e! as Map<Object?, Object?>).cast<String, Object?>(),
            )
            .toList();

    test('generated catalog matches the manifest', () {
      expect(kPictoCatalog.length, pictos.length);
      expect(kPictoCatalog.keys.toList(), <String>[
        for (final p in pictos) p['name']! as String,
      ]);
      for (final p in pictos) {
        final PictoMeta meta = kPictoCatalog[p['name']]!;
        expect(meta.category.name, p['category']);
        expect(meta.emoji, p['emoji']);
        expect(
          meta.labels,
          (p['labels']! as Map<Object?, Object?>).cast<String, String>(),
        );
      }
    });

    test(
      'ported emoji table equals manifest emojiToPicto (order included)',
      () {
        final Map<String, Object?> expected =
            (manifest['emojiToPicto']! as Map<Object?, Object?>)
                .cast<String, Object?>();
        expect(emojiToPicto.length, expected.length);
        for (final MapEntry<String, Object?> e in expected.entries) {
          expect(
            emojiToPicto[normalizeEmoji(e.key)],
            (e.value! as List<Object?>).cast<String>(),
            reason: e.key,
          );
        }
      },
    );

    test('every motif has a light and a dark SVG on disk', () {
      for (final p in pictos) {
        for (final String theme in <String>['light', 'dark']) {
          expect(
            File('assets/kids/pictos/$theme/${p['name']}.svg').existsSync(),
            isTrue,
            reason: '$theme/${p['name']}',
          );
        }
      }
    });
  });
}
