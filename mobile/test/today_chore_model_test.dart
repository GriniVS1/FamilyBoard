// Regression test for TodayChore.fromJson — in particular the additive,
// nullable `memberId`/`member` fields added so the Home Ämtli card can show
// an assignee chip and filter to the signed-in member (see
// `features/home/home_chore_filter.dart`). Older walls that predate this
// field must still parse cleanly (both keys simply absent).

import 'package:familyboard_mobile/models/today.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('TodayChore.fromJson parses an assigned chore', () {
    final TodayChore chore = TodayChore.fromJson(<String, Object?>{
      'id': 'chore_1',
      'title': 'Take out trash',
      'icon': '🗑️',
      'points': 3,
      'completedToday': false,
      'memberId': 'm1',
      'member': <String, Object?>{
        'id': 'm1',
        'name': 'Mia',
        'color': 'sky',
        'emoji': '🦊',
      },
    });

    expect(chore.id, 'chore_1');
    expect(chore.completedToday, isFalse);
    expect(chore.memberId, 'm1');
    expect(chore.member, isNotNull);
    expect(chore.member!.name, 'Mia');
    expect(chore.member!.color, 'sky');
  });

  test('TodayChore.fromJson treats a null member as unassigned', () {
    final TodayChore chore = TodayChore.fromJson(<String, Object?>{
      'id': 'chore_2',
      'title': 'Water the plants',
      'icon': null,
      'points': 1,
      'completedToday': true,
      'memberId': null,
      'member': null,
    });

    expect(chore.memberId, isNull);
    expect(chore.member, isNull);
    expect(chore.completedToday, isTrue);
  });

  test('TodayChore.fromJson tolerates memberId/member being absent entirely '
      '(pre-existing walls)', () {
    final TodayChore chore = TodayChore.fromJson(<String, Object?>{
      'id': 'chore_3',
      'title': 'Feed the cat',
      'icon': null,
      'points': 2,
      'completedToday': false,
    });

    expect(chore.memberId, isNull);
    expect(chore.member, isNull);
  });
}
