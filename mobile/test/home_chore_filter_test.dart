// Regression test for filterHomeChores — the Home Ämtli card must show only
// the signed-in member's own chores plus unassigned ones, while the full
// family list stays reachable via the Tasks screen.

import 'package:familyboard_mobile/features/home/home_chore_filter.dart';
import 'package:familyboard_mobile/models/today.dart';
import 'package:flutter_test/flutter_test.dart';

TodayChore _chore(String id, {String? memberId}) {
  return TodayChore(
    id: id,
    title: id,
    icon: null,
    points: 1,
    completedToday: false,
    memberId: memberId,
  );
}

void main() {
  test('filterHomeChores keeps own chores and unassigned chores', () {
    final List<TodayChore> chores = <TodayChore>[
      _chore('mine', memberId: 'me'),
      _chore('unassigned'),
      _chore('someone_elses', memberId: 'other'),
    ];

    final List<TodayChore> visible = filterHomeChores(chores, 'me');

    expect(visible.map((TodayChore c) => c.id), <String>['mine', 'unassigned']);
  });

  test('filterHomeChores returns an empty list when nothing matches', () {
    final List<TodayChore> chores = <TodayChore>[
      _chore('someone_elses', memberId: 'other'),
    ];

    expect(filterHomeChores(chores, 'me'), isEmpty);
  });
}
