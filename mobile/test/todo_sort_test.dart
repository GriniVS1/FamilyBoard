// Unit tests for the pure sorting/grouping helpers in `models/todo_sort.dart`
// backing the due-date UI on Home and the Tasks screen.

import 'package:familyboard_mobile/models/todo_item.dart';
import 'package:familyboard_mobile/models/todo_sort.dart';
import 'package:flutter_test/flutter_test.dart';

TodoItem _todo(
  String id, {
  bool done = false,
  DateTime? dueDate,
  String title = '',
}) {
  return TodoItem(
    id: id,
    title: title.isEmpty ? id : title,
    done: done,
    dueDate: dueDate,
    member: null,
  );
}

void main() {
  group('sortTodosForDisplay', () {
    test('keeps the API done/not-done partition boundary intact', () {
      final List<TodoItem> input = <TodoItem>[
        _todo('open_undated'),
        _todo('done_1', done: true),
        _todo('done_2', done: true),
      ];

      final List<TodoItem> sorted = sortTodosForDisplay(input);

      expect(sorted.map((TodoItem t) => t.id), <String>[
        'open_undated',
        'done_1',
        'done_2',
      ]);
    });

    test('sorts dated todos ascending, before undated ones', () {
      final DateTime today = DateTime(2026, 5, 11);
      final List<TodoItem> input = <TodoItem>[
        _todo('undated'),
        _todo('later', dueDate: today.add(const Duration(days: 5))),
        _todo('overdue', dueDate: today.subtract(const Duration(days: 2))),
        _todo('today', dueDate: today),
      ];

      final List<TodoItem> sorted = sortTodosForDisplay(input);

      expect(sorted.map((TodoItem t) => t.id), <String>[
        'overdue',
        'today',
        'later',
        'undated',
      ]);
    });

    test('breaks ties by original index (stable sort)', () {
      // Dart's `List.sort` isn't guaranteed stable — this pins down that
      // two undated todos keep their original (API createdAt-desc) order.
      final List<TodoItem> input = <TodoItem>[
        _todo('first_undated'),
        _todo('second_undated'),
      ];

      final List<TodoItem> sorted = sortTodosForDisplay(input);

      expect(sorted.map((TodoItem t) => t.id), <String>[
        'first_undated',
        'second_undated',
      ]);
    });

    test('sorts the done partition independently from the open one', () {
      final DateTime today = DateTime(2026, 5, 11);
      final List<TodoItem> input = <TodoItem>[
        _todo('open_later', dueDate: today.add(const Duration(days: 3))),
        _todo(
          'done_earlier',
          done: true,
          dueDate: today.subtract(const Duration(days: 10)),
        ),
        _todo('done_undated', done: true),
      ];

      final List<TodoItem> sorted = sortTodosForDisplay(input);

      expect(sorted.map((TodoItem t) => t.id), <String>[
        'open_later',
        'done_earlier',
        'done_undated',
      ]);
    });
  });

  group('groupOpenTodosIntoSections', () {
    final DateTime now = DateTime(2026, 5, 11);

    test(
      'buckets into Überfällig / Heute / Diese Woche / Später / Ohne Datum',
      () {
        final List<TodoItem> open = <TodoItem>[
          _todo('overdue', dueDate: now.subtract(const Duration(days: 1))),
          _todo('today', dueDate: now),
          _todo('this_week', dueDate: now.add(const Duration(days: 3))),
          _todo('later', dueDate: now.add(const Duration(days: 30))),
          _todo('no_date'),
        ];

        final List<TodoSection> sections = groupOpenTodosIntoSections(
          open,
          now: now,
        );

        expect(sections.map((TodoSection s) => s.bucket), <TodoDueBucket>[
          TodoDueBucket.overdue,
          TodoDueBucket.today,
          TodoDueBucket.thisWeek,
          TodoDueBucket.later,
          TodoDueBucket.noDate,
        ]);
        expect(sections[0].todos.single.id, 'overdue');
        expect(sections[1].todos.single.id, 'today');
        expect(sections[2].todos.single.id, 'this_week');
        expect(sections[3].todos.single.id, 'later');
        expect(sections[4].todos.single.id, 'no_date');
      },
    );

    test('omits empty buckets entirely', () {
      final List<TodoItem> open = <TodoItem>[_todo('today', dueDate: now)];

      final List<TodoSection> sections = groupOpenTodosIntoSections(
        open,
        now: now,
      );

      expect(sections, hasLength(1));
      expect(sections.single.bucket, TodoDueBucket.today);
    });

    test('the day exactly 7 days out is "later", not "this week"', () {
      final List<TodoItem> open = <TodoItem>[
        _todo('exactly_7', dueDate: now.add(const Duration(days: 7))),
        _todo('exactly_6', dueDate: now.add(const Duration(days: 6))),
      ];

      final List<TodoSection> sections = groupOpenTodosIntoSections(
        open,
        now: now,
      );

      final TodoSection thisWeek = sections.firstWhere(
        (TodoSection s) => s.bucket == TodoDueBucket.thisWeek,
      );
      final TodoSection later = sections.firstWhere(
        (TodoSection s) => s.bucket == TodoDueBucket.later,
      );
      expect(thisWeek.todos.single.id, 'exactly_6');
      expect(later.todos.single.id, 'exactly_7');
    });

    test('returns no sections for an empty list', () {
      expect(groupOpenTodosIntoSections(const <TodoItem>[], now: now), isEmpty);
    });
  });
}
