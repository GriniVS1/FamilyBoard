import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/todos_service.dart';
import 'session_provider.dart';

/// Fetches the family-wide todo list (all members, includes `member` per
/// item). Distinct from [todayProvider]'s member-scoped `todos`.
///
/// Callers can trigger a manual refresh via `ref.invalidate(todosProvider)`.
final FutureProvider<TodosResult> todosProvider =
    FutureProvider<TodosResult>((Ref ref) async {
  final SessionState sessionState = ref.watch(sessionProvider);
  final session = sessionState.session;
  if (session == null) {
    throw const TodosFetchException('No active session');
  }
  return ref.watch(todosServiceProvider).fetchTodos(session);
});
