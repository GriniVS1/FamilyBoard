/// Pure client-side sorting/grouping helpers for the todo list.
///
/// `GET /api/mobile/todos` orders rows `done asc, createdAt desc` (see
/// `src/app/api/mobile/todos/route.ts`) — not-done todos first, newest first
/// within each group. Everything here re-sorts *within* those two API-level
/// groups by due date; it never moves a done todo ahead of an open one or
/// vice versa, so the "done" partition boundary from the API is preserved.
library;

import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';
import 'todo_item.dart';

/// Local midnight for [when] (defaults to now) — strips the time-of-day so
/// due-date comparisons are calendar-day based, matching the wall's
/// day-granular `dueDate` semantics.
DateTime todoMidnight([DateTime? when]) {
  final DateTime d = (when ?? DateTime.now()).toLocal();
  return DateTime(d.year, d.month, d.day);
}

int _compareDueDates(DateTime? a, DateTime? b) {
  if (a == null && b == null) {
    return 0;
  }
  // Dated todos sort before undated ones.
  if (a == null) {
    return 1;
  }
  if (b == null) {
    return -1;
  }
  return a.compareTo(b);
}

/// Sorts [todos] by due date ascending (undated last; overdue naturally
/// sorts first since its date is earliest) — but only *within* the not-done
/// and done partitions, preserving their relative API order otherwise.
///
/// `List.sort` is not guaranteed stable in Dart, so ties (equal due dates,
/// or both undated) are broken by original index to keep the API's
/// `createdAt desc` ordering intact.
List<TodoItem> sortTodosForDisplay(List<TodoItem> todos) {
  List<TodoItem> stableSortByDueDate(List<TodoItem> input) {
    final List<MapEntry<int, TodoItem>> indexed = <MapEntry<int, TodoItem>>[
      for (int i = 0; i < input.length; i++)
        MapEntry<int, TodoItem>(i, input[i]),
    ];
    indexed.sort((MapEntry<int, TodoItem> a, MapEntry<int, TodoItem> b) {
      final int byDate = _compareDueDates(a.value.dueDate, b.value.dueDate);
      if (byDate != 0) {
        return byDate;
      }
      return a.key.compareTo(b.key);
    });
    return indexed.map((MapEntry<int, TodoItem> e) => e.value).toList();
  }

  final List<TodoItem> open = todos.where((TodoItem t) => !t.done).toList();
  final List<TodoItem> done = todos.where((TodoItem t) => t.done).toList();
  return <TodoItem>[...stableSortByDueDate(open), ...stableSortByDueDate(done)];
}

/// Due-date buckets for the Tasks screen's sectioned to-do list. Only applied
/// to open (not-done) todos — done todos are rendered after, ungrouped (see
/// `groupOpenTodosIntoSections`'s doc).
enum TodoDueBucket { overdue, today, thisWeek, later, noDate }

class TodoSection {
  const TodoSection({required this.bucket, required this.todos});

  final TodoDueBucket bucket;
  final List<TodoItem> todos;
}

/// Buckets [openTodos] (must already be filtered to `!done` and sorted, e.g.
/// via [sortTodosForDisplay]) into ordered, non-empty sections:
/// Überfällig / Heute / Diese Woche / Später / Ohne Datum.
///
/// "Diese Woche" is the 6 days after today (today itself is its own
/// bucket); anything beyond that is "Später". Done todos are deliberately
/// excluded — completed items aren't meaningfully "overdue", and the Tasks
/// screen renders them after all sections, ungrouped.
List<TodoSection> groupOpenTodosIntoSections(
  List<TodoItem> openTodos, {
  DateTime? now,
}) {
  final DateTime today = todoMidnight(now);
  final DateTime weekEnd = today.add(const Duration(days: 7));

  final Map<TodoDueBucket, List<TodoItem>> buckets =
      <TodoDueBucket, List<TodoItem>>{
        for (final TodoDueBucket b in TodoDueBucket.values) b: <TodoItem>[],
      };

  for (final TodoItem t in openTodos) {
    final DateTime? due = t.dueDate;
    if (due == null) {
      buckets[TodoDueBucket.noDate]!.add(t);
      continue;
    }
    final DateTime day = todoMidnight(due);
    if (day.isBefore(today)) {
      buckets[TodoDueBucket.overdue]!.add(t);
    } else if (day.isAtSameMomentAs(today)) {
      buckets[TodoDueBucket.today]!.add(t);
    } else if (day.isBefore(weekEnd)) {
      buckets[TodoDueBucket.thisWeek]!.add(t);
    } else {
      buckets[TodoDueBucket.later]!.add(t);
    }
  }

  return <TodoSection>[
    for (final TodoDueBucket b in TodoDueBucket.values)
      if (buckets[b]!.isNotEmpty) TodoSection(bucket: b, todos: buckets[b]!),
  ];
}

/// Localised label for a due-date pill, or null when [dueDate] is unset.
String? todoDueLabel(DateTime? dueDate, AppL10n l10n) {
  if (dueDate == null) {
    return null;
  }
  final DateTime today = todoMidnight();
  final DateTime due = todoMidnight(dueDate);
  final int diff = due.difference(today).inDays;
  if (diff == 0) {
    return l10n.homeDueToday;
  }
  if (diff == 1) {
    return l10n.homeDueTomorrow;
  }
  if (diff < 0) {
    return l10n.homeOverdue(_shortDate(dueDate));
  }
  return l10n.homeDueOn(_shortDate(dueDate));
}

bool isTodoOverdue(DateTime? dueDate) {
  if (dueDate == null) {
    return false;
  }
  return todoMidnight(dueDate).isBefore(todoMidnight());
}

// Matches the format previously inlined in home_screen.dart / tasks_screen.dart
// (no explicit locale — same as before this file existed).
String _shortDate(DateTime date) =>
    DateFormat('EEE d.M').format(date.toLocal());

/// Localised label for a [TodoDueBucket] section header.
String todoDueBucketLabel(TodoDueBucket bucket, AppL10n l10n) {
  switch (bucket) {
    case TodoDueBucket.overdue:
      return l10n.todosSectionOverdue;
    case TodoDueBucket.today:
      return l10n.todosSectionToday;
    case TodoDueBucket.thisWeek:
      return l10n.todosSectionThisWeek;
    case TodoDueBucket.later:
      return l10n.todosSectionLater;
    case TodoDueBucket.noDate:
      return l10n.todosSectionNoDate;
  }
}
