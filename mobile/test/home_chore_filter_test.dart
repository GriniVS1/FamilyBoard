// Regression test for filterHomeChores — the Home Ämtli card must show only
// the signed-in member's own chores plus unassigned ones, while the full
// family list stays reachable on the Aufgaben tab.

import 'package:familyboard_mobile/features/home/home_chore_filter.dart';
import 'package:familyboard_mobile/models/chore.dart';
import 'package:flutter_test/flutter_test.dart';

Chore _chore(String id, {String? memberId}) {
  return Chore(
    id: id,
    title: id,
    icon: null,
    points: 1,
    rrule: null,
    memberId: memberId,
    member: null,
    completedToday: false,
    completedTodayBy: null,
  );
}

void main() {
  test('filterHomeChores keeps own chores and unassigned chores', () {
    final List<Chore> chores = <Chore>[
      _chore('mine', memberId: 'me'),
      _chore('unassigned'),
      _chore('someone_elses', memberId: 'other'),
    ];

    final List<Chore> visible = filterHomeChores(chores, 'me');

    expect(visible.map((Chore c) => c.id), <String>['mine', 'unassigned']);
  });

  test('filterHomeChores returns an empty list when nothing matches', () {
    final List<Chore> chores = <Chore>[
      _chore('someone_elses', memberId: 'other'),
    ];

    expect(filterHomeChores(chores, 'me'), isEmpty);
  });
}
