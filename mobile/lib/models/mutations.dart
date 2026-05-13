/// Typed results returned by the five mutation endpoints.
library;

/// Returned by `POST /api/mobile/todos` and `PATCH /api/mobile/todos/[id]`.
class TodoMutation {
  const TodoMutation({
    required this.id,
    required this.title,
    required this.done,
    required this.dueDate,
  });

  factory TodoMutation.fromJson(Map<String, Object?> json) {
    final Object? dueRaw = json['dueDate'];
    return TodoMutation(
      id: json['id']! as String,
      title: json['title']! as String,
      done: json['done'] == true,
      dueDate: dueRaw is String ? DateTime.tryParse(dueRaw) : null,
    );
  }

  final String id;
  final String title;
  final bool done;
  final DateTime? dueDate;
}

/// Returned by `POST /api/mobile/chores/[id]/complete`.
class ChoreCompletionResult {
  const ChoreCompletionResult({
    required this.completionId,
    required this.choreId,
    required this.memberId,
    required this.points,
    required this.completedToday,
    required this.alreadyCompletedToday,
  });

  factory ChoreCompletionResult.fromJson(Map<String, Object?> json) {
    return ChoreCompletionResult(
      completionId: json['completionId']! as String,
      choreId: json['choreId']! as String,
      memberId: json['memberId']! as String,
      points: json['points'] is int ? json['points']! as int : 0,
      completedToday: json['completedToday'] == true,
      alreadyCompletedToday: json['alreadyCompletedToday'] == true,
    );
  }

  final String completionId;
  final String choreId;
  final String memberId;
  final int points;
  final bool completedToday;
  final bool alreadyCompletedToday;
}

// ---------------------------------------------------------------------------
// Typed exceptions
// ---------------------------------------------------------------------------

/// 401 — bearer token revoked; go to /pair.
class MutationSessionRevokedException implements Exception {
  const MutationSessionRevokedException();
}

/// 404 — the item was deleted elsewhere (silently drop from UI).
class MutationNotFoundException implements Exception {
  const MutationNotFoundException(this.code);

  final String code;
}

/// 400 TOO_MANY_TODOS — show a toast, do not retry.
class MutationCapReachedException implements Exception {
  const MutationCapReachedException();
}

/// Anything else (5xx, network, parse).
class MutationFetchException implements Exception {
  const MutationFetchException(this.message);

  final String message;
}
