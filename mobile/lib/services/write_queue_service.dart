import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';

import '../db/cache_db.dart';
import '../models/session.dart';
import 'api_client.dart';

/// Event emitted when a queued mutation is permanently rejected by the server
/// (4xx). Screens listen to [WriteQueueService.replayFailures] to show a
/// snackbar.
class ReplayFailure {
  const ReplayFailure({required this.path, required this.message});

  /// The endpoint path that was rejected, e.g. `/api/mobile/chores/abc/complete`.
  final String path;

  /// Human-readable description from the server error envelope or HTTP status.
  final String message;
}

/// Thrown when an operation fails because the queue cap has been reached.
class WriteQueueFullException implements Exception {
  const WriteQueueFullException();
}

/// Synthetic response returned by [WriteQueueService.sendOrQueue] when the
/// mutation was enqueued rather than executed immediately.
///
/// Callers that only check status codes treat this as a success-ish result;
/// the actual outcome is determined later during replay.
final Response<Object?> _queuedResponse = Response<Object?>(
  requestOptions: RequestOptions(path: ''),
  statusCode: 202,
  data: <String, Object?>{'queued': true},
);

/// Backoff delays in milliseconds, capped at 5 minutes.
const List<int> _backoffMs = <int>[
  1000,
  4000,
  16000,
  64000,
  256000,
  300000,
];

int _backoffForRetry(int retryCount) {
  final int index = retryCount.clamp(0, _backoffMs.length - 1);
  return _backoffMs[index];
}

/// Whether a [DioException] indicates a transient network failure that warrants
/// queuing the mutation for later replay.
bool _isNetworkFailure(DioException e) {
  return e.type == DioExceptionType.connectionError ||
      e.type == DioExceptionType.connectionTimeout ||
      e.type == DioExceptionType.sendTimeout ||
      e.type == DioExceptionType.receiveTimeout;
}

/// Orchestrates the write queue: tries a mutation live; on network failure,
/// enqueues it; on reconnect, replays queued items FIFO.
class WriteQueueService {
  WriteQueueService({
    required CacheDb db,
    required ApiClientFactory clientFactory,
  })  : _db = db,
        _clientFactory = clientFactory;

  final CacheDb _db;
  final ApiClientFactory _clientFactory;

  final StreamController<ReplayFailure> _failureController =
      StreamController<ReplayFailure>.broadcast();

  /// Permanent 4xx failures surfaced during replay.
  Stream<ReplayFailure> get replayFailures => _failureController.stream;

  /// Tries the mutation online. Falls back to the queue on network / 5xx
  /// failure. On 4xx re-throws (caller handles permanent errors).
  ///
  /// Returns [_queuedResponse] when the item was queued instead of sent.
  Future<Response<Object?>> sendOrQueue({
    required Session session,
    required String method,
    required String path,
    Map<String, Object?>? body,
    String? tempId,
  }) async {
    final Dio dio = _clientFactory.authenticated(session);
    try {
      final Response<Object?> response = await _sendRequest(
        dio: dio,
        method: method,
        path: path,
        body: body,
      );

      // 5xx: server is broken — queue for later.
      final int status = response.statusCode ?? 0;
      if (status >= 500) {
        await _enqueue(
          session: session,
          method: method,
          path: path,
          body: body,
          tempId: tempId,
        );
        return _queuedResponse;
      }

      return response;
    } on DioException catch (e) {
      if (_isNetworkFailure(e)) {
        await _enqueue(
          session: session,
          method: method,
          path: path,
          body: body,
          tempId: tempId,
        );
        return _queuedResponse;
      }
      rethrow;
    }
  }

  /// Replays queued items for [session.member.id] in FIFO order.
  ///
  /// Stops at the first network failure (so we don't burn through the queue
  /// against a wall that isn't reachable). Returns the count of successfully
  /// replayed items.
  Future<int> replay(Session session) async {
    final String memberId = session.member.id;
    final List<QueuedWrite> batch =
        await _db.nextBatch(memberId: memberId, limit: 20);
    if (batch.isEmpty) return 0;

    final Dio dio = _clientFactory.authenticated(session);
    int replayed = 0;

    for (final QueuedWrite item in batch) {
      Map<String, Object?>? bodyMap;
      if (item.body != null) {
        final Object? decoded = jsonDecode(item.body!);
        if (decoded is Map) {
          bodyMap = (decoded as Map<Object?, Object?>).cast<String, Object?>();
        }
      }

      try {
        final Response<Object?> response = await _sendRequest(
          dio: dio,
          method: item.method,
          path: item.path,
          body: bodyMap,
        );

        final int status = response.statusCode ?? 0;

        if (status >= 500) {
          // Treat 5xx like a network failure — back off, stop batch.
          await _db.markFailed(
            item.id,
            'Server error $status',
            _backoffForRetry(item.retryCount),
          );
          break;
        }

        if (status >= 400 && status < 500) {
          // Permanent failure — drop the item and notify listeners.
          await _db.remove(item.id);
          _failureController.add(
            ReplayFailure(
              path: item.path,
              message: _extractServerError(response) ?? 'HTTP $status',
            ),
          );
          // Continue — the next item may succeed.
          continue;
        }

        // Success.
        await _db.remove(item.id);
        replayed++;
      } on DioException catch (e) {
        if (_isNetworkFailure(e)) {
          await _db.markFailed(
            item.id,
            e.message ?? 'Network error',
            _backoffForRetry(item.retryCount),
          );
          break;
        }
        // Unexpected Dio error (e.g. bad certificate): treat as permanent.
        await _db.remove(item.id);
        _failureController.add(
          ReplayFailure(
            path: item.path,
            message: e.message ?? 'Unknown error',
          ),
        );
      }
    }

    return replayed;
  }

  Future<void> dispose() async {
    await _failureController.close();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  Future<void> _enqueue({
    required Session session,
    required String method,
    required String path,
    Map<String, Object?>? body,
    String? tempId,
  }) async {
    final String? encoded = body != null ? jsonEncode(body) : null;
    try {
      await _db.enqueue(
        memberId: session.member.id,
        method: method,
        path: path,
        body: encoded,
        tempId: tempId,
      );
    } on QueueFullException {
      throw const WriteQueueFullException();
    }
  }

  Future<Response<Object?>> _sendRequest({
    required Dio dio,
    required String method,
    required String path,
    Map<String, Object?>? body,
  }) async {
    switch (method.toUpperCase()) {
      case 'POST':
        return dio.post<Object?>(path, data: body);
      case 'PATCH':
        return dio.patch<Object?>(path, data: body);
      case 'DELETE':
        return dio.delete<Object?>(path);
      default:
        throw ArgumentError('Unsupported method: $method');
    }
  }

  String? _extractServerError(Response<Object?> response) {
    final Object? data = response.data;
    if (data is Map) {
      final Object? error = (data as Map<Object?, Object?>)['error'];
      if (error is Map<Object?, Object?>) {
        final Object? message = error['message'];
        if (message is String) return message;
        final Object? code = error['code'];
        if (code is String) return code;
      }
    }
    return null;
  }
}
