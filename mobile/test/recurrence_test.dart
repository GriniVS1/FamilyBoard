// Regression test for the mobile RRULE builder, which must match the wall's
// `buildRrule` in `src/components/calendar/event-dialog.tsx`: FREQ-only, with
// UNTIL fixed at UTC midnight of the chosen end date.

import 'package:familyboard_mobile/models/recurrence.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('buildRrule returns null for RecurrenceFreq.none', () {
    expect(buildRrule(RecurrenceFreq.none), isNull);
  });

  test('buildRrule without an end date', () {
    expect(buildRrule(RecurrenceFreq.daily), equals('FREQ=DAILY'));
    expect(buildRrule(RecurrenceFreq.weekly), equals('FREQ=WEEKLY'));
    expect(buildRrule(RecurrenceFreq.monthly), equals('FREQ=MONTHLY'));
  });

  test('buildRrule with an end date appends UTC-midnight UNTIL', () {
    final String? rule = buildRrule(
      RecurrenceFreq.weekly,
      untilDate: DateTime(2026, 12, 31),
    );
    expect(rule, equals('FREQ=WEEKLY;UNTIL=20261231T000000Z'));
  });

  test('buildRrule pads single-digit month/day', () {
    final String? rule = buildRrule(
      RecurrenceFreq.monthly,
      untilDate: DateTime(2026, 3, 5),
    );
    expect(rule, equals('FREQ=MONTHLY;UNTIL=20260305T000000Z'));
  });

  test('buildRrule ignores untilDate when freq is none', () {
    expect(
      buildRrule(RecurrenceFreq.none, untilDate: DateTime(2026, 1, 1)),
      isNull,
    );
  });
}
