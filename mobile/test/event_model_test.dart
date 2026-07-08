// Regression test for MobileEvent.fromJson and the synthetic recurring-id
// detection (`masterId__recurrenceId`) used to decide when a scope
// (instance/series) prompt is required for edit/delete.

import 'package:familyboard_mobile/models/event.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, Object?> _memberJson() => <String, Object?>{
      'id': 'm1',
      'name': 'Mia',
      'color': 'sky',
      'emoji': '🦊',
    };

void main() {
  test('MobileEvent.isRecurringInstance detects the synthetic id shape', () {
    final MobileEvent plain = MobileEvent.fromJson(<String, Object?>{
      'id': 'evt_123',
      'title': 'Dentist',
      'description': null,
      'location': null,
      'startsAt': '2026-05-11T09:00:00.000Z',
      'endsAt': '2026-05-11T10:00:00.000Z',
      'allDay': false,
      'color': null,
      'source': 'LOCAL',
      'member': _memberJson(),
    });
    expect(plain.isRecurringInstance, isFalse);

    final MobileEvent instance = MobileEvent.fromJson(<String, Object?>{
      'id': 'evt_123__2026-05-18T09:00:00.000Z',
      'title': 'Dentist',
      'description': null,
      'location': null,
      'startsAt': '2026-05-18T09:00:00.000Z',
      'endsAt': '2026-05-18T10:00:00.000Z',
      'allDay': false,
      'color': null,
      'source': 'LOCAL',
      'member': _memberJson(),
    });
    expect(instance.isRecurringInstance, isTrue);
  });
}
