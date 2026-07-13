import 'package:dio/dio.dart';

import '../db/cache_db.dart';
import '../models/session.dart';
import '../models/todo_item.dart';
import 'api_client.dart';
import 'cache_service.dart';

/// Thrown when the server returns 401 (session revoked).
class TodosSessionRevokedException implements Exception {
  const TodosSessionRevokedException();
}

/// Thrown for non-401 failures (network, server error, parse error) when no
/// cached data is available.
class TodosFetchException implements Exception {
  const TodosFetchException(this.message);

  final String message;
}

/// Result of [TodosService.fetchTodos].
class TodosResult {
  const TodosResult({required this.todos, this.staleAt});

  final List<TodoItem> todos;

  /// Non-null when this result was served from the disk cache.
  final DateTime? staleAt;
}

/// Read-only client for `GET /api/mobile/todos` — the family-wide todo list.
///
/// Unlike `TodayPayload.todos` (member-filtered), this endpoint returns every
/// todo in the family with its assigned `member` (nullable). Writes still go
/// through [MutationsService] — this service only backs the Home dashboard's
/// read path.
class TodosService {
  TodosService({
    required ApiClientFactory clientFactory,
    required CacheDb cacheDb,
  })  : _clientFactory = clientFactory,
        _cached = CachedGet(cacheDb);

  final ApiClientFactory _clientFactory;
  final CachedGet _cached;

  Future<TodosResult> fetchTodos(Session session) async {
    final CachedGetResult result;
    try {
      result = await _cached.get(
        dio: _clientFactory.authenticated(session),
        path: '/api/mobile/todos',
        memberId: session.member.id,
      );
    } on DioException catch (e) {
      throw TodosFetchException('Network error: ${e.message}');
    }

    if (result.statusCode == 401) {
      throw const TodosSessionRevokedException();
    }
    if (result.statusCode != 200) {
      throw TodosFetchException('Unexpected status ${result.statusCode}');
    }

    final Object? data = result.data;
    if (data is! Map) {
      throw const TodosFetchException('Unexpected response format');
    }
    try {
      final Map<String, Object?> body =
          (data as Map<Object?, Object?>).cast<String, Object?>();
      final List<Object?> todosRaw =
          body['todos'] is List ? body['todos']! as List<Object?> : <Object?>[];
      final List<TodoItem> todos = todosRaw
          .whereType<Map<Object?, Object?>>()
          .map((Map<Object?, Object?> t) =>
              TodoItem.fromJson(t.cast<String, Object?>()))
          .toList();
      return TodosResult(todos: todos, staleAt: result.cachedAt);
    } catch (e) {
      throw TodosFetchException('Parse error: $e');
    }
  }
}
