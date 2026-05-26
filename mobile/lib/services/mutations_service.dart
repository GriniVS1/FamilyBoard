import 'package:dio/dio.dart';

import '../models/mutations.dart';
import '../models/session.dart';
import 'write_queue_service.dart';

/// Executes the five write-side endpoints for todos and chores.
///
/// On network / 5xx failures, mutations are transparently queued via
/// [WriteQueueService] and replayed when connectivity returns. On 4xx,
/// typed exceptions are thrown so callers can respond immediately.
///
/// [WriteQueueFullException] is translated to [MutationFetchException] with
/// code `QUEUE_FULL` — callers should surface `queueFull` in the UI.
class MutationsService {
  MutationsService({required WriteQueueService writeQueueService})
      : _queue = writeQueueService;

  final WriteQueueService _queue;

  // --------------------------------------------------------------------------
  // Todos
  // --------------------------------------------------------------------------

  Future<TodoMutation> createTodo({
    required Session session,
    required String title,
    DateTime? dueDate,
    String? tempId,
  }) async {
    final Map<String, Object?> body = <String, Object?>{
      'title': title,
      if (dueDate != null) 'dueDate': dueDate.toIso8601String(),
    };
    final Response<Object?> response = await _sendOrQueue(
      session: session,
      method: 'POST',
      path: '/api/mobile/todos',
      body: body,
      tempId: tempId,
    );

    if (_wasQueued(response)) {
      return TodoMutation(
        id: tempId ?? 'temp_pending',
        title: title,
        done: false,
        dueDate: dueDate,
      );
    }

    _guardSuccess(response: response, expected: 201);
    return TodoMutation.fromJson(_extractMap(response.data));
  }

  Future<TodoMutation> toggleTodo({
    required Session session,
    required String id,
    required bool done,
  }) async {
    final Map<String, Object?> body = <String, Object?>{'done': done};
    final Response<Object?> response = await _sendOrQueue(
      session: session,
      method: 'PATCH',
      path: '/api/mobile/todos/$id',
      body: body,
    );

    if (_wasQueued(response)) {
      return TodoMutation(id: id, title: '', done: done, dueDate: null);
    }

    _guardSuccess(response: response, expected: 200);
    return TodoMutation.fromJson(_extractMap(response.data));
  }

  Future<void> deleteTodo({
    required Session session,
    required String id,
  }) async {
    final Response<Object?> response = await _sendOrQueue(
      session: session,
      method: 'DELETE',
      path: '/api/mobile/todos/$id',
    );

    if (_wasQueued(response)) return;
    _guardSuccess(response: response, expected: 200);
  }

  // --------------------------------------------------------------------------
  // Chores
  // --------------------------------------------------------------------------

  Future<ChoreCompletionResult> completeChore({
    required Session session,
    required String id,
  }) async {
    final Response<Object?> response = await _sendOrQueue(
      session: session,
      method: 'POST',
      path: '/api/mobile/chores/$id/complete',
      body: <String, Object?>{},
    );

    if (_wasQueued(response)) {
      return ChoreCompletionResult(
        completionId: 'temp_pending',
        choreId: id,
        memberId: session.member.id,
        points: 0,
        completedToday: true,
        alreadyCompletedToday: false,
      );
    }

    _guardSuccess(response: response, expected: 200);
    return ChoreCompletionResult.fromJson(_extractMap(response.data));
  }

  /// Returns true when something was actually undone, false for NO_OP.
  Future<bool> undoChoreCompletion({
    required Session session,
    required String id,
  }) async {
    final Response<Object?> response = await _sendOrQueue(
      session: session,
      method: 'DELETE',
      path: '/api/mobile/chores/$id/complete',
    );

    if (_wasQueued(response)) return true;

    final int status = response.statusCode ?? 0;
    if (status == 401) throw const MutationSessionRevokedException();
    if (status == 404) {
      throw MutationNotFoundException(_errorCode(response.data));
    }
    if (status == 400) {
      final String code = _errorCode(response.data);
      if (code == 'NO_OP') return false;
      throw MutationFetchException('400 $code');
    }
    if (status != 200) {
      throw MutationFetchException('Unexpected status $status');
    }

    final Map<String, Object?> data = _extractMap(response.data);
    return data['undone'] == true;
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /// Delegates to [WriteQueueService.sendOrQueue], translating
  /// [WriteQueueFullException] into [MutationFetchException].
  Future<Response<Object?>> _sendOrQueue({
    required Session session,
    required String method,
    required String path,
    Map<String, Object?>? body,
    String? tempId,
  }) async {
    try {
      return await _queue.sendOrQueue(
        session: session,
        method: method,
        path: path,
        body: body,
        tempId: tempId,
      );
    } on WriteQueueFullException {
      throw const MutationFetchException('QUEUE_FULL');
    }
  }

  bool _wasQueued(Response<Object?> response) {
    if ((response.statusCode ?? 0) != 202) return false;
    final Object? data = response.data;
    if (data is! Map) return false;
    return (data as Map<Object?, Object?>)['queued'] == true;
  }

  void _guardSuccess({
    required Response<Object?> response,
    required int expected,
  }) {
    final int status = response.statusCode ?? 0;
    if (status == 401) throw const MutationSessionRevokedException();
    if (status == 404) {
      throw MutationNotFoundException(_errorCode(response.data));
    }
    if (status == 400) {
      final String code = _errorCode(response.data);
      if (code == 'TOO_MANY_TODOS') throw const MutationCapReachedException();
      throw MutationFetchException('400 $code');
    }
    if (status != expected) {
      throw MutationFetchException('Unexpected status $status');
    }
  }

  String _errorCode(Object? data) {
    if (data is Map) {
      final Object? error = (data as Map<Object?, Object?>)['error'];
      if (error is Map) {
        final Object? code = (error as Map<Object?, Object?>)['code'];
        if (code is String) return code;
      }
    }
    return 'UNKNOWN';
  }

  Map<String, Object?> _extractMap(Object? data) {
    if (data is! Map) {
      throw const MutationFetchException('Unexpected response format');
    }
    return (data as Map<Object?, Object?>).cast<String, Object?>();
  }
}
