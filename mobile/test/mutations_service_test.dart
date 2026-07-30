// Unit tests for the pure payload-building logic in `MutationsService`
// (`buildCreateChorePayload`, `buildUpdateTodoDueDatePayload`) and
// `ChoreMutation.fromJson` parsing. The network-calling parts of
// `MutationsService.createChore`/`updateTodoDueDate` are exercised through
// the app-tester's integration pass, not here.

import 'package:familyboard_mobile/models/mutations.dart';
import 'package:familyboard_mobile/services/mutations_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('buildUpdateTodoDueDatePayload', () {
    test('sends an ISO date string when setting a due date', () {
      final Map<String, Object?> body = buildUpdateTodoDueDatePayload(
        DateTime.parse('2026-05-11T00:00:00.000Z'),
      );

      expect(body, <String, Object?>{'dueDate': '2026-05-11T00:00:00.000Z'});
    });

    test(
      'sends an explicit null (not an absent key) when removing the due date',
      () {
        final Map<String, Object?> body = buildUpdateTodoDueDatePayload(null);

        // The key must be *present* — the wall's zod schema
        // (`z.coerce.date().nullable().optional()`) reads a present `null`
        // as "clear the field" and an absent key as "leave it untouched".
        expect(body.containsKey('dueDate'), isTrue);
        expect(body['dueDate'], isNull);
      },
    );
  });

  group('buildCreateChorePayload', () {
    test('omits rrule entirely for "Keine" (no recurrence)', () {
      final Map<String, Object?> body = buildCreateChorePayload(
        title: 'Zimmer aufräumen',
        memberId: 'member-1',
        points: 3,
      );

      expect(body.containsKey('rrule'), isFalse);
      expect(body['memberId'], equals('member-1'));
      expect(body['title'], equals('Zimmer aufräumen'));
      expect(body['points'], equals(3));
    });

    test('sends memberId explicitly as null for "Niemand"', () {
      final Map<String, Object?> body = buildCreateChorePayload(
        title: 'Geschirrspüler',
        memberId: null,
        points: 1,
      );

      expect(body.containsKey('memberId'), isTrue);
      expect(body['memberId'], isNull);
    });

    test('includes rrule when a recurrence is selected', () {
      final Map<String, Object?> weekly = buildCreateChorePayload(
        title: 'Müll rausbringen',
        memberId: 'member-2',
        points: 2,
        rrule: 'FREQ=WEEKLY',
      );
      expect(weekly['rrule'], equals('FREQ=WEEKLY'));

      final Map<String, Object?> daily = buildCreateChorePayload(
        title: 'Bett machen',
        memberId: 'member-2',
        points: 1,
        rrule: 'FREQ=DAILY',
      );
      expect(daily['rrule'], equals('FREQ=DAILY'));
    });

    test('omits icon when null or empty, includes it otherwise', () {
      final Map<String, Object?> noIcon = buildCreateChorePayload(
        title: 'Staubsaugen',
        memberId: null,
        points: 1,
      );
      expect(noIcon.containsKey('icon'), isFalse);

      final Map<String, Object?> emptyIcon = buildCreateChorePayload(
        title: 'Staubsaugen',
        memberId: null,
        points: 1,
        icon: '',
      );
      expect(emptyIcon.containsKey('icon'), isFalse);

      final Map<String, Object?> withIcon = buildCreateChorePayload(
        title: 'Staubsaugen',
        memberId: null,
        points: 1,
        icon: '🧹',
      );
      expect(withIcon['icon'], equals('🧹'));
    });

    test('defaults are stable regardless of argument order', () {
      final Map<String, Object?> body = buildCreateChorePayload(
        points: 5,
        title: 'Wäsche',
        icon: '🧺',
        memberId: 'member-3',
        rrule: 'FREQ=DAILY',
      );
      expect(body, <String, Object?>{
        'memberId': 'member-3',
        'title': 'Wäsche',
        'icon': '🧺',
        'points': 5,
        'rrule': 'FREQ=DAILY',
      });
    });
  });

  group('ChoreMutation.fromJson', () {
    test('parses the full response shape', () {
      final ChoreMutation chore = ChoreMutation.fromJson(<String, Object?>{
        'id': 'chore-1',
        'familyId': 'family-1',
        'memberId': 'member-1',
        'title': 'Zimmer aufräumen',
        'icon': '🧹',
        'points': 3,
        'rrule': 'FREQ=WEEKLY;BYDAY=SA',
        'createdAt': '2026-07-24T09:00:00.000Z',
      });

      expect(chore.id, equals('chore-1'));
      expect(chore.familyId, equals('family-1'));
      expect(chore.memberId, equals('member-1'));
      expect(chore.title, equals('Zimmer aufräumen'));
      expect(chore.icon, equals('🧹'));
      expect(chore.points, equals(3));
      expect(chore.rrule, equals('FREQ=WEEKLY;BYDAY=SA'));
      expect(
        chore.createdAt,
        equals(DateTime.parse('2026-07-24T09:00:00.000Z')),
      );
    });

    test('treats a null memberId and rrule as null, not a parse error', () {
      final ChoreMutation chore = ChoreMutation.fromJson(<String, Object?>{
        'id': 'chore-2',
        'familyId': 'family-1',
        'memberId': null,
        'title': 'Geschirrspüler',
        'icon': null,
        'points': 1,
        'rrule': null,
        'createdAt': '2026-07-24T09:00:00.000Z',
      });

      expect(chore.memberId, isNull);
      expect(chore.icon, isNull);
      expect(chore.rrule, isNull);
    });
  });
}
