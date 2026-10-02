// Port of src/lib/chore-state.test.ts (every case) plus time-of-day phase
// boundaries from src/lib/time-of-day.ts.

import 'package:familyboard_mobile/kids/chore_state.dart';
import 'package:familyboard_mobile/kids/time_of_day.dart';
import 'package:flutter_test/flutter_test.dart';

class TestChore implements ChoreLike {
  const TestChore({
    required this.id,
    required this.title,
    required this.memberId,
    required this.timeOfDay,
    this.points = 1,
  });

  @override
  final String id;
  final String title;
  @override
  final String? memberId;
  @override
  final ChoreTimeOfDay? timeOfDay;
  @override
  final int points;
}

const String mia = 'mia';
const String leo = 'leo';

int _seq = 0;

TestChore chore(
  String title,
  ChoreTimeOfDay? timeOfDay, [
  String? memberId = mia,
]) {
  _seq += 1;
  return TestChore(
    id: 'c$_seq',
    title: title,
    memberId: memberId,
    timeOfDay: timeOfDay,
  );
}

CompletionLike done(ChoreLike c, [String memberId = mia]) =>
    Completion(choreId: c.id, memberId: memberId);

DateTime at(int hour, [int minute = 0]) => DateTime(2026, 9, 30, hour, minute);

const ChoreTimeOfDay morningTod = ChoreTimeOfDay.morning;
const ChoreTimeOfDay dayTod = ChoreTimeOfDay.day;
const ChoreTimeOfDay eveningTod = ChoreTimeOfDay.evening;

void main() {
  group('nextChoreFor', () {
    test('morning picks the first open morning chore', () {
      final TestChore day = chore('day', dayTod);
      final TestChore morning = chore('morning', morningTod);
      final TestChore? next = nextChoreFor(
        mia,
        <TestChore>[day, morning],
        <CompletionLike>[],
        at(7),
      );
      expect(next?.title, 'morning');
    });

    test('day prefers a day chore over an open morning one', () {
      final TestChore morning = chore('morning', morningTod);
      final TestChore day = chore('day', dayTod);
      expect(
        nextChoreFor(
          mia,
          <TestChore>[morning, day],
          <CompletionLike>[],
          at(13),
        )?.title,
        'day',
      );
    });

    test('evening picks an evening chore', () {
      final TestChore day = chore('day', dayTod);
      final TestChore evening = chore('evening', eveningTod);
      expect(
        nextChoreFor(
          mia,
          <TestChore>[day, evening],
          <CompletionLike>[],
          at(19),
        )?.title,
        'evening',
      );
    });

    test('night marks nothing as next', () {
      final TestChore evening = chore('evening', eveningTod);
      final TestChore anytime = chore('anytime', null);
      expect(
        nextChoreFor(
          mia,
          <TestChore>[evening, anytime],
          <CompletionLike>[],
          at(2),
        ),
        isNull,
      );
    });

    test('anytime chores fill in when the current phase has nothing open', () {
      final TestChore morning = chore('morning', morningTod);
      final TestChore anytime = chore('water', null);
      final TestChore day = chore('day', dayTod);
      final TestChore? next = nextChoreFor(
        mia,
        <TestChore>[morning, anytime, day],
        <CompletionLike>[done(day)],
        at(13),
      );
      expect(next?.title, 'water');
    });

    test('a current-phase chore beats an anytime chore listed before it', () {
      final TestChore anytime = chore('water', null);
      final TestChore day = chore('day', dayTod);
      expect(
        nextChoreFor(
          mia,
          <TestChore>[anytime, day],
          <CompletionLike>[],
          at(12),
        )?.title,
        'day',
      );
    });

    test('catches up on the most recent earlier phase first', () {
      final TestChore morning = chore('morning', morningTod);
      final TestChore day = chore('day', dayTod);
      final TestChore? next = nextChoreFor(
        mia,
        <TestChore>[morning, day],
        <CompletionLike>[],
        at(18),
      );
      expect(next?.title, 'day');
    });

    test(
      'catches up on morning when that is all that is left in the evening',
      () {
        final TestChore morning = chore('morning', morningTod);
        final TestChore evening = chore('evening', eveningTod);
        final TestChore? next = nextChoreFor(
          mia,
          <TestChore>[morning, evening],
          <CompletionLike>[done(evening)],
          at(20),
        );
        expect(next?.title, 'morning');
      },
    );

    test('does not pull chores from later phases forward', () {
      final TestChore evening = chore('evening', eveningTod);
      expect(
        nextChoreFor(mia, <TestChore>[evening], <CompletionLike>[], at(8)),
        isNull,
      );
    });

    test(
      'skips chores that are already done and moves to the following one',
      () {
        final TestChore a = chore('a', morningTod);
        final TestChore b = chore('b', morningTod);
        expect(
          nextChoreFor(
            mia,
            <TestChore>[a, b],
            <CompletionLike>[],
            at(6),
          )?.title,
          'a',
        );
        expect(
          nextChoreFor(
            mia,
            <TestChore>[a, b],
            <CompletionLike>[done(a)],
            at(6),
          )?.title,
          'b',
        );
        expect(
          nextChoreFor(
            mia,
            <TestChore>[a, b],
            <CompletionLike>[done(a), done(b)],
            at(6),
          ),
          isNull,
        );
      },
    );

    test("never marks unassigned chores and ignores other members' chores", () {
      final TestChore shared = chore('laundry', null, null);
      final TestChore leos = chore("leo's", morningTod, leo);
      expect(
        nextChoreFor(mia, <TestChore>[shared, leos], <CompletionLike>[], at(7)),
        isNull,
      );
      expect(
        nextChoreFor(
          leo,
          <TestChore>[shared, leos],
          <CompletionLike>[],
          at(7),
        )?.title,
        "leo's",
      );
    });

    test('treats a completion by someone else as done', () {
      final TestChore a = chore('a', morningTod);
      expect(
        nextChoreFor(
          mia,
          <TestChore>[a],
          <CompletionLike>[done(a, leo)],
          at(7),
        ),
        isNull,
      );
    });
  });

  group('columnSummary', () {
    test('reports active with the next chore and counts', () {
      final TestChore a = chore('a', morningTod);
      final TestChore b = chore('b', dayTod);
      final ColumnSummary<TestChore> s = columnSummary(
        mia,
        <TestChore>[a, b],
        <CompletionLike>[done(a)],
        at(12),
      );
      expect(s.state, ColumnState.active);
      expect(s.next?.title, 'b');
      expect(<int>[s.done, s.total, s.open], <int>[1, 2, 1]);
    });

    test('reports allDone when every chore is done', () {
      final TestChore a = chore('a', morningTod);
      final ColumnSummary<TestChore> s = columnSummary(
        mia,
        <TestChore>[a],
        <CompletionLike>[done(a)],
        at(9),
      );
      expect(s.state, ColumnState.allDone);
      expect(s.next, isNull);
    });

    test('reports allDone (not night) when nothing is left after midnight', () {
      final TestChore a = chore('a', eveningTod);
      expect(
        columnSummary(
          mia,
          <TestChore>[a],
          <CompletionLike>[done(a)],
          at(1),
        ).state,
        ColumnState.allDone,
      );
    });

    test(
      'reports pause with the upcoming phase when only later chores are open',
      () {
        final TestChore evening = chore('evening', eveningTod);
        final ColumnSummary<TestChore> s = columnSummary(
          mia,
          <TestChore>[evening],
          <CompletionLike>[],
          at(9),
        );
        expect(s.state, ColumnState.pause);
        expect(s.upcomingPhase, ChoreTimeOfDay.evening);
      },
    );

    test('reports night with open chores between 00:00 and 04:59', () {
      final TestChore a = chore('a', morningTod);
      expect(
        columnSummary(mia, <TestChore>[a], <CompletionLike>[], at(4, 59)).state,
        ColumnState.night,
      );
      expect(
        columnSummary(mia, <TestChore>[a], <CompletionLike>[], at(5)).state,
        ColumnState.active,
      );
    });

    test('reports empty for a person without chores', () {
      final TestChore other = chore('x', dayTod, leo);
      expect(
        columnSummary(
          mia,
          <TestChore>[other],
          <CompletionLike>[],
          at(12),
        ).state,
        ColumnState.empty,
      );
    });

    test(
      "counts only the person's assigned chores toward the day progress",
      () {
        final TestChore a = chore('a', morningTod);
        final TestChore b = chore('b', dayTod);
        final TestChore shared = chore('shared', null, null);
        final ({int done, int total}) progress = dayProgress(
          mia,
          <TestChore>[a, b, shared],
          <CompletionLike>[done(a), done(shared)],
        );
        expect(progress, (done: 1, total: 2));
      },
    );
  });

  group('groupByPhase', () {
    test(
      'orders groups morning, day, evening, anytime and drops empty ones',
      () {
        final TestChore any = chore('any', null);
        final TestChore evening = chore('evening', eveningTod);
        final TestChore morning = chore('morning', morningTod);
        final List<ChoreGroup<TestChore>> groups = groupByPhase(
          <TestChore>[any, evening, morning],
          <CompletionLike>[],
          null,
        );
        expect(
          groups.map((ChoreGroup<TestChore> g) => g.key).toList(),
          <PhaseGroupKey>[
            PhaseGroupKey.morning,
            PhaseGroupKey.evening,
            PhaseGroupKey.anytime,
          ],
        );
      },
    );

    test(
      'sorts next, open, done inside a group and keeps API order otherwise',
      () {
        final TestChore a = chore('a', dayTod);
        final TestChore b = chore('b', dayTod);
        final TestChore c = chore('c', dayTod);
        final TestChore d = chore('d', dayTod);
        final ChoreGroup<TestChore> group = groupByPhase(
          <TestChore>[a, b, c, d],
          <CompletionLike>[done(a), done(c)],
          d.id,
        ).first;
        expect(
          group.entries
              .map(
                (ChoreEntry<TestChore> e) =>
                    '${e.chore.title}:${e.status.name}',
              )
              .toList(),
          <String>['d:next', 'b:open', 'a:done', 'c:done'],
        );
        expect(<int>[group.done, group.total], <int>[2, 4]);
      },
    );

    test('never yields a next entry when no next id is given', () {
      final TestChore shared = chore('shared', null, null);
      final List<ChoreGroup<TestChore>> groups = groupByPhase(
        <TestChore>[shared],
        <CompletionLike>[],
        null,
      );
      expect(groups.first.entries.first.status, ChoreStatus.open);
    });
  });

  group('expandedGroupKeys', () {
    test('opens the running phase and anytime', () {
      expect(expandedGroupKeys(DayPhase.day, null), <PhaseGroupKey>{
        PhaseGroupKey.anytime,
        PhaseGroupKey.day,
      });
    });

    test('also opens the group that holds a catch-up next chore', () {
      final TestChore late = chore('late', morningTod);
      expect(expandedGroupKeys(DayPhase.evening, late), <PhaseGroupKey>{
        PhaseGroupKey.anytime,
        PhaseGroupKey.evening,
        PhaseGroupKey.morning,
      });
    });

    test('opens only anytime at night', () {
      expect(expandedGroupKeys(DayPhase.night, null), <PhaseGroupKey>{
        PhaseGroupKey.anytime,
      });
    });
  });

  group('completionFor', () {
    test('returns the latest completion for the chore', () {
      final TestChore shared = chore('shared', null, null);
      final CompletionLike first = Completion(
        choreId: shared.id,
        memberId: mia,
      );
      final CompletionLike second = Completion(
        choreId: shared.id,
        memberId: leo,
      );
      expect(
        completionFor(shared.id, <CompletionLike>[first, second])?.memberId,
        leo,
      );
      expect(completionFor('missing', <CompletionLike>[first]), isNull);
    });
  });

  group('time of day', () {
    test('phase boundaries (R4.4)', () {
      expect(phaseOf(at(0)), DayPhase.night);
      expect(phaseOf(at(4, 59)), DayPhase.night);
      expect(phaseOf(at(5)), DayPhase.morning);
      expect(phaseOf(at(10, 59)), DayPhase.morning);
      expect(phaseOf(at(11)), DayPhase.day);
      expect(phaseOf(at(16, 59)), DayPhase.day);
      expect(phaseOf(at(17)), DayPhase.evening);
      expect(phaseOf(at(23, 59)), DayPhase.evening);
    });

    test('earlier and later phases', () {
      expect(earlierPhases(DayPhase.evening), <ChoreTimeOfDay>[
        ChoreTimeOfDay.day,
        ChoreTimeOfDay.morning,
      ]);
      expect(earlierPhases(DayPhase.morning), isEmpty);
      expect(earlierPhases(DayPhase.night), isEmpty);
      expect(laterPhases(DayPhase.morning), <ChoreTimeOfDay>[
        ChoreTimeOfDay.day,
        ChoreTimeOfDay.evening,
      ]);
      expect(laterPhases(DayPhase.night), kPhaseOrder);
    });

    test('currentPhase uses the injected clock', () {
      expect(currentPhase(() => at(18)), DayPhase.evening);
    });
  });
}
