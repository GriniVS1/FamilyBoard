import 'package:dio/dio.dart';

import '../models/family_member.dart';
import '../models/session.dart';
import 'api_client.dart';

/// Thrown when the server returns 401 (bearer token revoked).
class MembersSessionRevokedException implements Exception {
  const MembersSessionRevokedException();
}

/// Thrown on 403 NOT_ADMIN — the acting member isn't an admin.
class MembersNotAdminException implements Exception {
  const MembersNotAdminException();
}

/// Thrown when an update/delete would leave the family without an admin.
class MembersLastAdminException implements Exception {
  const MembersLastAdminException();
}

/// Thrown when a delete would leave the family without any members.
class MembersLastMemberException implements Exception {
  const MembersLastMemberException();
}

/// Thrown when the 8-member cap is hit on create.
class MembersCapReachedException implements Exception {
  const MembersCapReachedException();
}

/// Thrown when the member was already removed by another client (404).
class MembersNotFoundException implements Exception {
  const MembersNotFoundException();
}

/// Thrown for any other failure (network, 5xx, parse errors, unmapped codes).
class MembersFetchException implements Exception {
  const MembersFetchException(this.message);

  final String message;
}

/// CRUD service for the `/api/mobile/members` endpoints. Online-only, like
/// [CalendarSetupService] — member administration has no sensible offline
/// replay story.
class MembersService {
  MembersService({required ApiClientFactory clientFactory})
      : _clientFactory = clientFactory;

  final ApiClientFactory _clientFactory;

  Future<MembersResult> fetchMembers(Session session) async {
    final Response<Object?> response = await _send(
      session,
      method: 'GET',
      path: '',
    );
    _guard(response, expected: const <int>{200});
    return MembersResult.fromJson(_extractMap(response));
  }

  Future<FamilyMember> createMember({
    required Session session,
    required String name,
    required String color,
    String? emoji,
    MemberRole? role,
  }) async {
    final Response<Object?> response = await _send(
      session,
      method: 'POST',
      path: '',
      body: <String, Object?>{
        'name': name,
        'color': color,
        if (emoji != null) 'emoji': emoji,
        if (role != null) 'role': memberRoleToJson(role),
      },
    );
    _guard(response, expected: const <int>{200, 201});
    return FamilyMember.fromJson(_extractMemberMap(response));
  }

  Future<FamilyMember> updateMember({
    required Session session,
    required String id,
    String? name,
    String? color,
    String? emoji,
    MemberRole? role,
  }) async {
    final Response<Object?> response = await _send(
      session,
      method: 'PATCH',
      path: '/${Uri.encodeComponent(id)}',
      body: <String, Object?>{
        if (name != null) 'name': name,
        if (color != null) 'color': color,
        if (emoji != null) 'emoji': emoji,
        if (role != null) 'role': memberRoleToJson(role),
      },
    );
    _guard(response, expected: const <int>{200});
    return FamilyMember.fromJson(_extractMemberMap(response));
  }

  Future<void> deleteMember({
    required Session session,
    required String id,
  }) async {
    final Response<Object?> response = await _send(
      session,
      method: 'DELETE',
      path: '/${Uri.encodeComponent(id)}',
    );
    _guard(response, expected: const <int>{200});
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  Future<Response<Object?>> _send(
    Session session, {
    required String method,
    required String path,
    Map<String, Object?>? body,
  }) async {
    final Dio dio = _clientFactory.authenticated(session);
    try {
      return await dio.request<Object?>(
        '/api/mobile/members$path',
        data: body,
        options: Options(method: method),
      );
    } on DioException catch (e) {
      throw MembersFetchException('Network error: ${e.message}');
    }
  }

  void _guard(Response<Object?> response, {required Set<int> expected}) {
    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const MembersSessionRevokedException();
    }
    if (expected.contains(status)) {
      return;
    }
    if (status == 404) {
      throw const MembersNotFoundException();
    }
    final String code = _errorCodeFromResponse(response);
    switch (code) {
      case 'NOT_ADMIN':
        throw const MembersNotAdminException();
      case 'LAST_ADMIN':
        throw const MembersLastAdminException();
      case 'LAST_MEMBER':
        throw const MembersLastMemberException();
      case 'TOO_MANY_MEMBERS':
      case 'MAX_MEMBERS_REACHED':
        throw const MembersCapReachedException();
      default:
        throw MembersFetchException('$status $code');
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
    final Object? data = response.data;
    if (data is! Map) {
      throw const MembersFetchException('Unexpected response format');
    }
    return (data as Map<Object?, Object?>).cast<String, Object?>();
  }

  Map<String, Object?> _extractMemberMap(Response<Object?> response) {
    final Object? raw = _extractMap(response)['member'];
    if (raw is! Map) {
      throw const MembersFetchException('Unexpected response format');
    }
    return (raw as Map<Object?, Object?>).cast<String, Object?>();
  }
}
