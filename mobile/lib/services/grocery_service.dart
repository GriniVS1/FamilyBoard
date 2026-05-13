import 'package:dio/dio.dart';

import '../models/grocery.dart';
import '../models/session.dart';
import 'api_client.dart';

/// Thrown when the server returns 401 (bearer token revoked).
class GrocerySessionRevokedException implements Exception {
  const GrocerySessionRevokedException();
}

/// Thrown when the server returns 404 GROCERY_NOT_FOUND.
class GroceryNotFoundException implements Exception {
  const GroceryNotFoundException();
}

/// Thrown when the server returns 400 TOO_MANY_ITEMS.
class GroceryCapReachedException implements Exception {
  const GroceryCapReachedException();
}

/// Thrown for any other failure (5xx, network, parse).
class GroceryFetchException implements Exception {
  const GroceryFetchException(this.message);

  final String message;
}

/// HTTP client for all five grocery endpoints.
///
/// All errors are translated to typed exceptions; callers never inspect raw
/// DioException or HTTP status codes.
class GroceryService {
  GroceryService({required ApiClientFactory clientFactory})
      : _clientFactory = clientFactory;

  final ApiClientFactory _clientFactory;

  Future<List<GroceryItem>> fetchAll(Session session) async {
    final Response<Object?> response = await _get(
      session: session,
      path: '/api/mobile/grocery',
    );
    final Map<String, Object?> body = _extractMap(response);
    final Object? rawItems = body['items'];
    if (rawItems is! List) {
      throw const GroceryFetchException('Unexpected response format');
    }
    return rawItems
        .whereType<Map<Object?, Object?>>()
        .map((Map<Object?, Object?> m) =>
            GroceryItem.fromJson(m.cast<String, Object?>()))
        .toList();
  }

  Future<GroceryItem> create(
    Session session, {
    required String name,
    double? quantity,
    String? unit,
    GroceryCategory? category,
  }) async {
    final Map<String, Object?> body = <String, Object?>{
      'name': name,
      if (quantity != null) 'quantity': quantity,
      if (unit != null && unit.isNotEmpty) 'unit': unit,
      if (category != null && category != GroceryCategory.uncategorized)
        'category': category.name,
    };
    final Response<Object?> response = await _post(
      session: session,
      path: '/api/mobile/grocery',
      body: body,
    );
    _guard(response, expected: 201);
    return GroceryItem.fromJson(_extractMap(response));
  }

  Future<GroceryItem> patch(
    Session session, {
    required String id,
    bool? checked,
    String? name,
    double? quantity,
    String? unit,
    GroceryCategory? category,
  }) async {
    final Map<String, Object?> body = <String, Object?>{
      if (checked != null) 'checked': checked,
      if (name != null) 'name': name,
      if (quantity != null) 'quantity': quantity,
      if (unit != null) 'unit': unit,
      if (category != null && category != GroceryCategory.uncategorized)
        'category': category.name,
    };
    final Response<Object?> response = await _patch(
      session: session,
      path: '/api/mobile/grocery/$id',
      body: body,
    );
    _guard(response, expected: 200);
    return GroceryItem.fromJson(_extractMap(response));
  }

  Future<void> delete(Session session, {required String id}) async {
    final Response<Object?> response = await _delete(
      session: session,
      path: '/api/mobile/grocery/$id',
    );
    _guard(response, expected: 200);
  }

  Future<int> clearChecked(Session session) async {
    final Response<Object?> response = await _post(
      session: session,
      path: '/api/mobile/grocery/clear-checked',
      body: <String, Object?>{},
    );
    _guard(response, expected: 200);
    final Map<String, Object?> body = _extractMap(response);
    return body['deleted'] is int ? body['deleted']! as int : 0;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  Future<Response<Object?>> _get({
    required Session session,
    required String path,
  }) async {
    final Dio dio = _clientFactory.authenticated(session);
    try {
      return await dio.get<Object?>(path);
    } on DioException catch (e) {
      throw GroceryFetchException('Network error: ${e.message}');
    }
  }

  Future<Response<Object?>> _post({
    required Session session,
    required String path,
    required Map<String, Object?> body,
  }) async {
    final Dio dio = _clientFactory.authenticated(session);
    try {
      return await dio.post<Object?>(path, data: body);
    } on DioException catch (e) {
      throw GroceryFetchException('Network error: ${e.message}');
    }
  }

  Future<Response<Object?>> _patch({
    required Session session,
    required String path,
    required Map<String, Object?> body,
  }) async {
    final Dio dio = _clientFactory.authenticated(session);
    try {
      return await dio.patch<Object?>(path, data: body);
    } on DioException catch (e) {
      throw GroceryFetchException('Network error: ${e.message}');
    }
  }

  Future<Response<Object?>> _delete({
    required Session session,
    required String path,
  }) async {
    final Dio dio = _clientFactory.authenticated(session);
    try {
      return await dio.delete<Object?>(path);
    } on DioException catch (e) {
      throw GroceryFetchException('Network error: ${e.message}');
    }
  }

  void _guard(Response<Object?> response, {required int expected}) {
    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const GrocerySessionRevokedException();
    }
    if (status == 404) {
      throw const GroceryNotFoundException();
    }
    if (status == 400) {
      final String code = _errorCode(response);
      if (code == 'TOO_MANY_ITEMS') {
        throw const GroceryCapReachedException();
      }
      throw GroceryFetchException('400 $code');
    }
    if (status != expected) {
      throw GroceryFetchException('Unexpected status $status');
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
      throw const GroceryFetchException('Unexpected response format');
    }
    return (data as Map<Object?, Object?>).cast<String, Object?>();
  }
}
