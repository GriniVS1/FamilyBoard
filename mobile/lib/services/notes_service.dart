import 'package:dio/dio.dart';

import '../models/note.dart';
import '../models/session.dart';
import 'api_client.dart';

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

/// CRUD service for the `/api/mobile/notes` endpoints.
class NotesService {
  NotesService({required ApiClientFactory clientFactory})
      : _clientFactory = clientFactory;

  final ApiClientFactory _clientFactory;

  Future<List<Note>> fetchNotes(Session session) async {
    final Response<Object?> response = await _send(
      session: session,
      request: (Dio dio) => dio.get<Object?>('/api/mobile/notes'),
    );
    _guardStatus(response, expected: 200);
    final Map<String, Object?> data = _extractMap(response);
    final Object? notesRaw = data['notes'];
    if (notesRaw is! List) {
      throw const NoteFetchException('Unexpected response format');
    }
    return notesRaw
        .cast<Object?>()
        .map((Object? e) => Note.fromJson(
              (e as Map<Object?, Object?>).cast<String, Object?>(),
            ))
        .toList();
  }

  Future<Note> createNote({
    required Session session,
    required String body,
    String color = 'sun',
    bool pinned = false,
  }) async {
    final Map<String, Object?> payload = <String, Object?>{
      'body': body,
      'color': color,
      'pinned': pinned,
    };
    final Response<Object?> response = await _send(
      session: session,
      request: (Dio dio) =>
          dio.post<Object?>('/api/mobile/notes', data: payload),
    );
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
    final Response<Object?> response = await _send(
      session: session,
      request: (Dio dio) =>
          dio.patch<Object?>('/api/mobile/notes/$id', data: payload),
    );
    _guardStatus(response, expected: 200);
    return Note.fromJson(_extractMap(response));
  }

  Future<void> deleteNote({
    required Session session,
    required String id,
  }) async {
    final Response<Object?> response = await _send(
      session: session,
      request: (Dio dio) => dio.delete<Object?>('/api/mobile/notes/$id'),
    );
    _guardStatus(response, expected: 200);
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  Future<Response<Object?>> _send({
    required Session session,
    required Future<Response<Object?>> Function(Dio dio) request,
  }) async {
    final Dio dio = _clientFactory.authenticated(session);
    try {
      return await request(dio);
    } on DioException catch (e) {
      throw NoteFetchException('Network error: ${e.message}');
    }
  }

  void _guardStatus(Response<Object?> response, {required int expected}) {
    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const NoteSessionRevokedException();
    }
    if (status == 404) {
      throw const NoteNotFoundException();
    }
    if (status == 400) {
      final String code = _errorCode(response);
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
      throw const NoteFetchException('Unexpected response format');
    }
    return (data as Map<Object?, Object?>).cast<String, Object?>();
  }
}
