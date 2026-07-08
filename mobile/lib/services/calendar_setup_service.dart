import 'package:dio/dio.dart';

import '../models/calendar_setup.dart';
import '../models/session.dart';
import 'api_client.dart';

/// Thrown when the server returns 401 (bearer token revoked).
class CalendarSetupSessionRevokedException implements Exception {
  const CalendarSetupSessionRevokedException();
}

/// Known error codes the wall's calendar-setup endpoints return in their
/// `{ error: { code } }` envelope. [unknown] covers anything else (including
/// 5xx and network failures), where [CalendarSetupException.rawCode] carries
/// whatever the server sent, if any.
enum CalendarSetupErrorCode {
  providerConflict,
  googleNotConfigured,
  microsoftNotConfigured,
  brokerUnreachable,
  unknown,
}

/// Thrown by every connect/disconnect call on a non-2xx response other than
/// 401.
class CalendarSetupException implements Exception {
  const CalendarSetupException(this.code, {this.rawCode});

  final CalendarSetupErrorCode code;
  final String? rawCode;
}

CalendarSetupErrorCode _mapErrorCode(String? code) {
  switch (code) {
    case 'PROVIDER_CONFLICT':
      return CalendarSetupErrorCode.providerConflict;
    case 'GOOGLE_NOT_CONFIGURED':
      return CalendarSetupErrorCode.googleNotConfigured;
    case 'MICROSOFT_NOT_CONFIGURED':
      return CalendarSetupErrorCode.microsoftNotConfigured;
    case 'BROKER_UNREACHABLE':
      return CalendarSetupErrorCode.brokerUnreachable;
    default:
      return CalendarSetupErrorCode.unknown;
  }
}

/// Service for the `/api/mobile/calendar/*` settings endpoints: read
/// connection status and drive the connect/disconnect flows for Google,
/// Microsoft, and CalDAV. Online-only — unlike notes/grocery/today, these
/// calls never queue offline (there is nothing sensible to replay).
class CalendarSetupService {
  CalendarSetupService({ApiClientFactory? clientFactory})
      : _clientFactory = clientFactory ?? const ApiClientFactory();

  final ApiClientFactory _clientFactory;

  Future<CalendarStatus> fetchStatus(Session session) async {
    final Response<Object?> response = await _get(session, '/status');
    return CalendarStatus.fromJson(_extractMap(response));
  }

  Future<String> connectGoogle(Session session) async {
    final Response<Object?> response = await _post(session, '/connect-google');
    return _extractAuthorizeUrl(response);
  }

  Future<String> connectMicrosoft(Session session) async {
    final Response<Object?> response =
        await _post(session, '/connect-microsoft');
    return _extractAuthorizeUrl(response);
  }

  Future<List<CaldavCalendarOption>> connectCaldav(
    Session session, {
    String? serverUrl,
    required String username,
    required String password,
    CaldavPreset? preset,
  }) async {
    final Response<Object?> response = await _post(
      session,
      '/connect-caldav',
      body: <String, Object?>{
        if (serverUrl != null && serverUrl.isNotEmpty) 'serverUrl': serverUrl,
        'username': username,
        'password': password,
        if (preset != null) 'preset': preset.name,
      },
    );
    final Map<String, Object?> body = _extractMap(response);
    final Object? calendarsRaw = body['calendars'];
    if (calendarsRaw is! List) {
      throw const CalendarSetupException(CalendarSetupErrorCode.unknown);
    }
    return calendarsRaw
        .whereType<Map<Object?, Object?>>()
        .map((Map<Object?, Object?> m) =>
            CaldavCalendarOption.fromJson(m.cast<String, Object?>()))
        .toList();
  }

  Future<void> selectCaldavCalendar(
    Session session, {
    required String calendarUrl,
    required String calendarName,
  }) async {
    await _post(
      session,
      '/select-caldav-calendar',
      body: <String, Object?>{
        'calendarUrl': calendarUrl,
        'calendarName': calendarName,
      },
    );
  }

  Future<void> disconnect(Session session) async {
    await _post(session, '/disconnect');
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  Future<Response<Object?>> _get(Session session, String subpath) async {
    final Dio dio = _clientFactory.authenticated(session);
    final Response<Object?> response;
    try {
      response = await dio.get<Object?>('/api/mobile/calendar$subpath');
    } on DioException {
      throw const CalendarSetupException(CalendarSetupErrorCode.unknown);
    }
    _guard(response, expected: 200);
    return response;
  }

  Future<Response<Object?>> _post(
    Session session,
    String subpath, {
    Map<String, Object?>? body,
  }) async {
    final Dio dio = _clientFactory.authenticated(session);
    final Response<Object?> response;
    try {
      response = await dio.post<Object?>(
        '/api/mobile/calendar$subpath',
        data: body,
      );
    } on DioException {
      throw const CalendarSetupException(CalendarSetupErrorCode.unknown);
    }
    _guard(response, expected: 200);
    return response;
  }

  void _guard(Response<Object?> response, {required int expected}) {
    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const CalendarSetupSessionRevokedException();
    }
    if (status == expected) {
      return;
    }
    final String? rawCode = _errorCodeFromResponse(response);
    throw CalendarSetupException(_mapErrorCode(rawCode), rawCode: rawCode);
  }

  String _extractAuthorizeUrl(Response<Object?> response) {
    final Object? raw = _extractMap(response)['authorizeUrl'];
    if (raw is! String || raw.isEmpty) {
      throw const CalendarSetupException(CalendarSetupErrorCode.unknown);
    }
    return raw;
  }

  String? _errorCodeFromResponse(Response<Object?> response) {
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
    return null;
  }

  Map<String, Object?> _extractMap(Response<Object?> response) {
    final Object? data = response.data;
    if (data is! Map) {
      throw const CalendarSetupException(CalendarSetupErrorCode.unknown);
    }
    return (data as Map<Object?, Object?>).cast<String, Object?>();
  }
}
