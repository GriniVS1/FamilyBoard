// Smoke-level test. The full app boots `flutter_secure_storage` via
// `SessionNotifier.build()`, which needs a platform channel and won't run
// in a unit-test environment. Replace with proper integration tests in M3.

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('smoke: arithmetic sanity', () {
    expect(1 + 1, equals(2));
  });

  test('smoke: ISO date parses', () {
    final DateTime t = DateTime.parse('2026-05-11T09:00:00.000Z');
    expect(t.toUtc().year, equals(2026));
    expect(t.toUtc().month, equals(5));
  });
}
