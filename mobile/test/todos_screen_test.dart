// Widget test of the To-dos screen behind Mehr (/todos). Replaces the To-dos
// segment coverage of the deleted Tasks screen test.

import 'dart:async';

import 'package:familyboard_mobile/features/tasks/todos_screen.dart';
import 'package:familyboard_mobile/models/todo_item.dart';
import 'package:familyboard_mobile/services/todos_service.dart';
import 'package:familyboard_mobile/state/todos_provider.dart';
import 'package:familyboard_mobile/widgets/todo_composer.dart';
import 'package:familyboard_mobile/widgets/todo_row.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import 'support/kid_harness.dart';

Future<Harness> _pump(
  WidgetTester tester,
  Future<TodosResult> Function() load,
) async {
  tester.view.devicePixelRatio = 3;
  tester.view.physicalSize = const Size(390, 1000) * 3;
  addTearDown(tester.view.reset);
  final Harness h = Harness(tester);
  await tester.pumpWidget(
    h.app(
      const TodosScreen(),
      extra: <Override>[todosProvider.overrideWith((Ref ref) => load())],
    ),
  );
  await tester.pump();
  await tester.pump();
  return h;
}

void main() {
  testWidgets('lists the family to-dos with their assignee and the composer', (
    WidgetTester tester,
  ) async {
    await _pump(
      tester,
      () async => const TodosResult(
        todos: <TodoItem>[
          TodoItem(
            id: 't1',
            title: 'Milch kaufen',
            done: false,
            dueDate: null,
            member: TodoMember(
              id: 'mia',
              name: 'Mia',
              color: 'lilac',
              emoji: '🦄',
            ),
          ),
          TodoItem(
            id: 't2',
            title: 'Altglas wegbringen',
            done: true,
            dueDate: null,
            member: null,
          ),
        ],
      ),
    );

    expect(find.byType(TodoComposerRow), findsOneWidget);
    expect(find.text('Milch kaufen'), findsOneWidget);
    expect(find.text('Altglas wegbringen'), findsOneWidget);
    expect(find.byType(TodoRow), findsNWidgets(2));
    expect(tester.takeException(), isNull);
  });

  testWidgets('a load error offers a retry that refetches', (
    WidgetTester tester,
  ) async {
    int calls = 0;
    await _pump(tester, () async {
      calls += 1;
      throw const TodosFetchException('down');
    });

    expect(find.byType(FilledButton), findsOneWidget);
    final int before = calls;
    await tester.tap(find.byType(FilledButton));
    await tester.pump();
    await tester.pump();
    expect(calls, greaterThan(before));
  });

  testWidgets('loading shows a spinner, not a stale or empty list', (
    WidgetTester tester,
  ) async {
    final Completer<TodosResult> never = Completer<TodosResult>();
    await _pump(tester, () => never.future);

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.byType(TodoRow), findsNothing);
  });
}
