/// POD models for the GET /api/mobile/todos response.
///
/// Distinct from [TodayTodo] (`models/today.dart`), which is member-scoped
/// and comes from `/api/mobile/today`. This model backs the family-wide todo
/// list shown on Home and carries the assigned [TodoMember] per item.
library;

class TodoMember {
  const TodoMember({
    required this.id,
    required this.name,
    required this.color,
    required this.emoji,
  });

  factory TodoMember.fromJson(Map<String, Object?> json) {
    return TodoMember(
      id: json['id']! as String,
      name: json['name']! as String,
      color: json['color']! as String,
      emoji: json['emoji'] is String ? json['emoji']! as String : '',
    );
  }

  final String id;
  final String name;

  /// One of the 8 accent names ("peach", "mint", "sun", …).
  final String color;
  final String emoji;
}

class TodoItem {
  const TodoItem({
    required this.id,
    required this.title,
    required this.done,
    required this.dueDate,
    required this.member,
  });

  factory TodoItem.fromJson(Map<String, Object?> json) {
    final Object? dueRaw = json['dueDate'];
    final Object? memberRaw = json['member'];
    final TodoMember? member = memberRaw is Map
        ? TodoMember.fromJson(
            (memberRaw as Map<Object?, Object?>).cast<String, Object?>(),
          )
        : null;

    return TodoItem(
      id: json['id']! as String,
      title: json['title']! as String,
      done: json['done'] == true,
      dueDate: dueRaw is String ? DateTime.tryParse(dueRaw) : null,
      member: member,
    );
  }

  final String id;
  final String title;
  final bool done;
  final DateTime? dueDate;

  /// Null when the todo is unassigned.
  final TodoMember? member;
}
