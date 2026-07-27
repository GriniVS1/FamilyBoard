// Regression test for Chore.fromJson — the family-wide GET /api/mobile/chores
// contract backing the Tasks screen's Ämtli segment. Covers the assigned +
// completed-by-someone-else shape and the fully-unassigned/never-completed
// shape.

import 'package:familyboard_mobile/models/chore.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Chore.fromJson parses an assigned, completed-today chore', () {
    final Chore chore = Chore.fromJson(<String, Object?>{
      'id': 'chore_1',
      'title': 'Take out trash',
      'icon': '🗑️',
      'points': 3,
      'rrule': 'FREQ=DAILY',
      'memberId': 'm1',
      'member': <String, Object?>{
        'id': 'm1',
        'name': 'Mia',
        'color': 'sky',
        'emoji': '🦊',
      },
      'completedToday': true,
      'completedTodayBy': <String, Object?>{
        'id': 'm2',
        'name': 'Noah',
        'color': 'mint',
        'emoji': '🐢',
      },
    });

    expect(chore.id, 'chore_1');
    expect(chore.rrule, 'FREQ=DAILY');
    expect(chore.memberId, 'm1');
    expect(chore.member!.name, 'Mia');
    expect(chore.completedToday, isTrue);
    // Someone other than the assignee can complete it — a distinct field.
    expect(chore.completedTodayBy!.name, 'Noah');
  });

  test('Chore.fromJson parses an unassigned, open chore', () {
    final Chore chore = Chore.fromJson(<String, Object?>{
      'id': 'chore_2',
      'title': 'Water the plants',
      'icon': null,
      'points': 1,
      'rrule': null,
      'memberId': null,
      'member': null,
      'completedToday': false,
      'completedTodayBy': null,
    });

    expect(chore.memberId, isNull);
    expect(chore.member, isNull);
    expect(chore.completedToday, isFalse);
    expect(chore.completedTodayBy, isNull);
  });
}
