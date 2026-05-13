import 'package:dio/dio.dart';

import '../models/mutations.dart';
import '../models/session.dart';
import 'api_client.dart';

/// Executes the five write-side endpoints for todos and chores.
///
/// All errors are translated into typed exceptions — callers never inspect
/// raw DioException or HTTP status codes.
class MutationsService {
  MutationsService({required ApiClientFactory clientFactory})
      : _clientFactory = clientFactory;

  final ApiClientFactory _clientFactory;

  // --------------------------------------------------------------------------
  // Todos
  // --------------------------------------------------------------------------

  Future<TodoMutation> createTodo({
    required Session session,
    required String title,
    DateTime? dueDate,
  }) async {
    final Map<String, Object?> body = <String, Object?>{
      'title': title,
      if (dueDate != null) 'dueDate': dueDate.toIso8601String(),
    };
    final Response<Object?> response = await _send(
      session: session,
      request: (Dio dio) => dio.post<Object?>('/api/mobile/todos', data: body),
    );
    _guardSuccess(response, expected: 201);
    return TodoMutation.fromJson(_extractMap(response));
  }

  Future<TodoMutation> toggleTodo({
    required Session session,
    required String id,
    required bool done,
  }) async {
    final Map<String, Object?> body = <String, Object?>{'done': done};
    final Response<Object?> response = await _send(
      session: session,
      request: (Dio dio) =>
          dio.patch<Object?>('/api/mobile/todos/$id', data: body),
    );
    _guardSuccess(response, expected: 200);
    return TodoMutation.fromJson(_extractMap(response));
  }

  Future<void> deleteTodo({
    required Session session,
    required String id,
  }) async {
    final Response<Object?> response = await _send(
      session: session,
      request: (Dio dio) => dio.delete<Object?>('/api/mobile/todos/$id'),
    );
    _guardSuccess(response, expected: 200);
  }

  // --------------------------------------------------------------------------
  // Chores
  // --------------------------------------------------------------------------

  Future<ChoreCompletionResult> completeChore({
    required Session session,
    required String id,
  }) async {
    final Response<Object?> response = await _send(
      session: session,
      request: (Dio dio) => dio.post<Object?>('/api/mobile/chores/$id/complete',
          data: <String, Object?>{}),
    );
    _guardSuccess(response, expected: 200);
    return ChoreCompletionResult.fromJson(_extractMap(response));
  }

  /// Returns true when something was actually undone, false for NO_OP.
  Future<bool> undoChoreCompletion({
    required Session session,
    required String id,
  }) async {
    final Response<Object?> response = await _send(
      session: session,
      request: (Dio dio) =>
          dio.delete<Object?>('/api/mobile/chores/$id/complete'),
    );

    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const MutationSessionRevokedException();
    }
    if (status == 404) {
      final String code = _errorCode(response);
      throw MutationNotFoundException(code);
    }
    if (status == 400) {
      final String code = _errorCode(response);
      if (code == 'NO_OP') {
        return false;
      }
      throw MutationFetchException('400 $code');
    }
    if (status != 200) {
      throw MutationFetchException('Unexpected status $status');
    }

    final Map<String, Object?> data = _extractMap(response);
    return data['undone'] == true;
  }

  // --------------------------------------------------------------------------
  // Shared helpers
  // --------------------------------------------------------------------------

  Future<Response<Object?>> _send({
    required Session session,
    required Future<Response<Object?>> Function(Dio dio) request,
  }) async {
    final Dio dio = _clientFactory.authenticated(session);
    try {
      return await request(dio);
    } on DioException catch (e) {
      throw MutationFetchException('Network error: ${e.message}');
    }
  }

  void _guardSuccess(Response<Object?> response, {required int expected}) {
    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const MutationSessionRevokedException();
    }
    if (status == 404) {
      final String code = _errorCode(response);
      throw MutationNotFoundException(code);
    }
    if (status == 400) {
      final String code = _errorCode(response);
      if (code == 'TOO_MANY_TODOS') {
        throw const MutationCapReachedException();
      }
      throw MutationFetchException('400 $code');
    }
    if (status != expected) {
      throw MutationFetchException('Unexpected status $status');
    }
  }

  String _errorCode(Response<Object?> response) {
    final Object? data = response.data;
    if (data is Map) {
      final Object? error = (data as Map<Object?, Object?>)['error'];
      if (error is Map) {
        final Object? code = (error as Map<Object?, Object?>)['code'];
        if (code is String) {
          return code;
        }
      }
    }
    return 'UNKNOWN';
  }

  Map<String, Object?> _extractMap(Response<Object?> response) {
    final Object? data = response.data;
    if (data is! Map) {
      throw const MutationFetchException('Unexpected response format');
    }
    return (data as Map<Object?, Object?>).cast<String, Object?>();
  }
}
