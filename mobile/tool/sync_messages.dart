// Validates that all mobile ARB files share the same key set, and
// (optionally) seeds missing English keys from the wall's `src/messages/en.json`.
//
// Usage:
//   dart run tool/sync_messages.dart            # validate only
//   dart run tool/sync_messages.dart --check    # validate only (alias)
//
// The wall (Next.js) and the mobile companion deliberately do not share their
// translation files — the wall uses nested JSON, Flutter uses ARB. But the
// mobile ARB is a deliberately small subset, so this script's job is mostly to
// keep the four ARB locales structurally identical. If you want to add a new
// mobile key, add it to all four ARB files and run this script.

import 'dart:convert';
import 'dart:io';

const List<String> _locales = <String>['en', 'de', 'fr', 'it'];

void main(List<String> args) {
  final Directory arbDir = Directory('lib/l10n');
  if (!arbDir.existsSync()) {
    stderr.writeln('lib/l10n directory not found (run from mobile/).');
    exit(2);
  }

  final Map<String, Set<String>> keysByLocale = <String, Set<String>>{};
  for (final String locale in _locales) {
    final File f = File('lib/l10n/app_$locale.arb');
    if (!f.existsSync()) {
      stderr.writeln('Missing: ${f.path}');
      exit(2);
    }
    final Object? decoded = jsonDecode(f.readAsStringSync());
    if (decoded is! Map) {
      stderr.writeln('${f.path}: not a JSON object');
      exit(2);
    }
    final Map<String, Object?> map =
        (decoded as Map<Object?, Object?>).cast<String, Object?>();
    keysByLocale[locale] = <String>{
      for (final String k in map.keys)
        if (!k.startsWith('@')) k,
    };
  }

  final Set<String> reference = keysByLocale['en']!;
  bool ok = true;
  for (final String locale in _locales.where((String l) => l != 'en')) {
    final Set<String> here = keysByLocale[locale]!;
    final Set<String> missing = reference.difference(here);
    final Set<String> extra = here.difference(reference);
    if (missing.isNotEmpty || extra.isNotEmpty) {
      ok = false;
      stderr.writeln('Locale $locale: '
          'missing=${missing.toList()..sort()}, '
          'extra=${extra.toList()..sort()}');
    }
  }

  if (!ok) {
    exit(1);
  }
  stdout.writeln(
    'OK: ${reference.length} keys present in all ${_locales.length} locales.',
  );
}
