import 'package:dio/dio.dart';

import '../db/cache_db.dart';
import '../models/note.dart';
import '../models/session.dart';
import 'api_client.dart';
import 'cache_service.dart';
import 'write_queue_service.dart';

/// Thrown when the server returns 401 (session revoked).
class NoteSessionRevokedException implements Exception {
  const NoteSessionRevokedException();
}

/// Thrown when the note was deleted by another client (404 NOTE_NOT_FOUND).
class NoteNotFoundException implements Exception {
  const NoteNotFoundException();
}

/// Thrown on 400 TOO_MANY_NOTES.
class NoteCapReachedException implements Exception {
  const NoteCapReachedException();
}

/// Thrown for 5xx / network failures / parse errors.
class NoteFetchException implements Exception {
  const NoteFetchException(this.message);

  final String message;
}

/// Result of [NotesService.fetchNotes].
class NotesResult {
  const NotesResult({required this.notes, this.staleAt});

  final List<Note> notes;

  /// Non-null when this result was served from the disk cache.
  final DateTime? staleAt;
}

/// CRUD service for the `/api/mobile/notes` endpoints.
///
/// Reads use [CachedGet] for offline fallback. Writes route through
/// [WriteQueueService] so they queue on network failure and replay on reconnect.
class NotesService {
  NotesService({
    required ApiClientFactory clientFactory,
    required CacheDb cacheDb,
    required WriteQueueService writeQueueService,
  })  : _clientFactory = clientFactory,
        _cached = CachedGet(cacheDb),
        _queue = writeQueueService;

  final ApiClientFactory _clientFactory;
  final CachedGet _cached;
  final WriteQueueService _queue;

  Future<NotesResult> fetchNotes(Session session) async {
    final CachedGetResult result;
    try {
      result = await _cached.get(
        dio: _clientFactory.authenticated(session),
        path: '/api/mobile/notes',
        memberId: session.member.id,
      );
    } on DioException catch (e) {
      throw NoteFetchException('Network error: ${e.message}');
    }
    _guardCode(result.statusCode, expected: 200);
    final Map<String, Object?> data = _extractMapFromData(result.data);
    final Object? notesRaw = data['notes'];
    if (notesRaw is! List) {
      throw const NoteFetchException('Unexpected response format');
    }
    final List<Note> notes = notesRaw
        .cast<Object?>()
        .map((Object? e) => Note.fromJson(
              (e as Map<Object?, Object?>).cast<String, Object?>(),
            ))
        .toList();
    return NotesResult(notes: notes, staleAt: result.cachedAt);
  }

  Future<Note> createNote({
    required Session session,
    required String body,
    String color = 'sun',
    bool pinned = false,
    String? tempId,
  }) async {
    final Map<String, Object?> payload = <String, Object?>{
      'body': body,
      'color': color,
      'pinned': pinned,
    };
    final Response<Object?> response = await _sendOrQueue(
      session: session,
      method: 'POST',
      path: '/api/mobile/notes',
      body: payload,
      tempId: tempId,
    );

    if (_wasQueued(response)) {
      return Note(
        id: tempId ?? 'temp_pending',
        familyId: session.family.id,
        body: body,
        color: color,
        pinned: pinned,
        createdAt: DateTime.now(),
        author: null,
      );
    }

    _guardStatus(response, expected: 201);
    return Note.fromJson(_extractMap(response));
  }

  Future<Note> updateNote({
    required Session session,
    required String id,
    String? body,
    String? color,
    bool? pinned,
  }) async {
    final Map<String, Object?> payload = <String, Object?>{
      if (body != null) 'body': body,
      if (color != null) 'color': color,
      if (pinned != null) 'pinned': pinned,
    };
    final Response<Object?> response = await _sendOrQueue(
      session: session,
      method: 'PATCH',
      path: '/api/mobile/notes/$id',
      body: payload,
    );

    if (_wasQueued(response)) {
      return Note(
        id: id,
        familyId: session.family.id,
        body: body ?? '',
        color: color ?? 'sun',
        pinned: pinned ?? false,
        createdAt: DateTime.now(),
        author: null,
      );
    }

    _guardStatus(response, expected: 200);
    return Note.fromJson(_extractMap(response));
  }

  Future<void> deleteNote({
    required Session session,
    required String id,
  }) async {
    final Response<Object?> response = await _sendOrQueue(
      session: session,
      method: 'DELETE',
      path: '/api/mobile/notes/$id',
    );

    if (_wasQueued(response)) return;
    _guardStatus(response, expected: 200);
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

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
      throw const NoteCapReachedException();
    }
  }

  bool _wasQueued(Response<Object?> response) {
    if ((response.statusCode ?? 0) != 202) return false;
    final Object? data = response.data;
    if (data is! Map) return false;
    return (data as Map<Object?, Object?>)['queued'] == true;
  }

  /// Used by mutation paths operating on a raw [Response].
  void _guardStatus(Response<Object?> response, {required int expected}) {
    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const NoteSessionRevokedException();
    }
    if (status == 404) {
      throw const NoteNotFoundException();
    }
    if (status == 400) {
      final String code = _errorCodeFromResponse(response);
      if (code == 'TOO_MANY_NOTES') {
        throw const NoteCapReachedException();
      }
      if (code == 'NO_OP') {
        return;
      }
      throw NoteFetchException('400 $code');
    }
    if (status >= 500) {
      throw NoteFetchException('Server error $status');
    }
    if (status != expected) {
      throw NoteFetchException('Unexpected status $status');
    }
  }

  /// Used by [fetchNotes] which goes through [CachedGet] and only has a plain
  /// int status code (no response body for error codes at this layer).
  void _guardCode(int status, {required int expected}) {
    if (status == 401) {
      throw const NoteSessionRevokedException();
    }
    if (status == 404) {
      throw const NoteNotFoundException();
    }
    if (status >= 500) {
      throw NoteFetchException('Server error $status');
    }
    if (status != expected) {
      throw NoteFetchException('Unexpected status $status');
    }
  }

  String _errorCodeFromResponse(Response<Object?> response) {
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
    return _extractMapFromData(response.data);
  }

  Map<String, Object?> _extractMapFromData(Object? data) {
    if (data is! Map) {
      throw const NoteFetchException('Unexpected response format');
    }
    return (data as Map<Object?, Object?>).cast<String, Object?>();
  }
}
