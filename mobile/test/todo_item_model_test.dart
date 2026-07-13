// Regression test for TodoItem.fromJson — in particular the nullable
// `member` field (null means the todo is unassigned) added for the
// family-wide Home dashboard "Familien-Aufgaben" card.

import 'package:familyboard_mobile/models/todo_item.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('TodoItem.fromJson parses an assigned todo', () {
    final TodoItem todo = TodoItem.fromJson(<String, Object?>{
      'id': 'todo_1',
      'title': 'Buy milk',
      'done': false,
      'dueDate': '2026-05-11T09:00:00.000Z',
      'member': <String, Object?>{
        'id': 'm1',
        'name': 'Mia',
        'color': 'sky',
        'emoji': '🦊',
      },
    });

    expect(todo.id, 'todo_1');
    expect(todo.title, 'Buy milk');
    expect(todo.done, isFalse);
    expect(todo.dueDate, DateTime.parse('2026-05-11T09:00:00.000Z'));
    expect(todo.member, isNotNull);
    expect(todo.member!.name, 'Mia');
    expect(todo.member!.color, 'sky');
  });

  test('TodoItem.fromJson treats a null member as unassigned', () {
    final TodoItem todo = TodoItem.fromJson(<String, Object?>{
      'id': 'todo_2',
      'title': 'Water the plants',
      'done': true,
      'dueDate': null,
      'member': null,
    });

    expect(todo.member, isNull);
    expect(todo.dueDate, isNull);
    expect(todo.done, isTrue);
  });
}
