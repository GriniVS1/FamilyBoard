import 'package:dio/dio.dart';

import '../db/cache_db.dart';
import '../models/grocery.dart';
import '../models/session.dart';
import 'api_client.dart';
import 'cache_service.dart';
import 'write_queue_service.dart';

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

/// Result of [GroceryService.fetchAll].
class GroceryResult {
  const GroceryResult({required this.items, this.staleAt});

  final List<GroceryItem> items;

  /// Non-null when this result was served from the disk cache.
  final DateTime? staleAt;
}

/// HTTP client for all five grocery endpoints.
///
/// Reads use [CachedGet] for offline fallback. Writes route through
/// [WriteQueueService] so they queue on network failure and replay on reconnect.
class GroceryService {
  GroceryService({
    required ApiClientFactory clientFactory,
    required CacheDb cacheDb,
    required WriteQueueService writeQueueService,
  })  : _clientFactory = clientFactory,
        _cached = CachedGet(cacheDb),
        _queue = writeQueueService;

  final ApiClientFactory _clientFactory;
  final CachedGet _cached;
  final WriteQueueService _queue;

  Future<GroceryResult> fetchAll(Session session) async {
    final CachedGetResult result;
    try {
      result = await _cached.get(
        dio: _clientFactory.authenticated(session),
        path: '/api/mobile/grocery',
        memberId: session.member.id,
      );
    } on DioException catch (e) {
      throw GroceryFetchException('Network error: ${e.message}');
    }
    _guardStatusInt(result.statusCode);
    final Map<String, Object?> body = _extractMapFromData(result.data);
    final Object? rawItems = body['items'];
    if (rawItems is! List) {
      throw const GroceryFetchException('Unexpected response format');
    }
    final List<GroceryItem> items = rawItems
        .whereType<Map<Object?, Object?>>()
        .map((Map<Object?, Object?> m) =>
            GroceryItem.fromJson(m.cast<String, Object?>()))
        .toList();
    return GroceryResult(items: items, staleAt: result.cachedAt);
  }

  Future<GroceryItem> create(
    Session session, {
    required String name,
    double? quantity,
    String? unit,
    GroceryCategory? category,
    String? tempId,
  }) async {
    final Map<String, Object?> body = <String, Object?>{
      'name': name,
      if (quantity != null) 'quantity': quantity,
      if (unit != null && unit.isNotEmpty) 'unit': unit,
      if (category != null && category != GroceryCategory.uncategorized)
        'category': category.name,
    };
    final Response<Object?> response = await _sendOrQueue(
      session: session,
      method: 'POST',
      path: '/api/mobile/grocery',
      body: body,
      tempId: tempId,
    );

    if (_wasQueued(response)) {
      final DateTime now = DateTime.now();
      return GroceryItem(
        id: tempId ?? 'temp_pending',
        familyId: session.family.id,
        name: name,
        quantity: quantity?.toString(),
        unit: unit,
        category: category ?? GroceryCategory.uncategorized,
        checked: false,
        source: null,
        order: 0,
        createdAt: now,
        updatedAt: now,
      );
    }

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
    final Response<Object?> response = await _sendOrQueue(
      session: session,
      method: 'PATCH',
      path: '/api/mobile/grocery/$id',
      body: body,
    );

    if (_wasQueued(response)) {
      final DateTime now = DateTime.now();
      return GroceryItem(
        id: id,
        familyId: session.family.id,
        name: name ?? '',
        quantity: quantity?.toString(),
        unit: unit,
        category: category ?? GroceryCategory.uncategorized,
        checked: checked ?? false,
        source: null,
        order: 0,
        createdAt: now,
        updatedAt: now,
      );
    }

    _guard(response, expected: 200);
    return GroceryItem.fromJson(_extractMap(response));
  }

  Future<void> delete(Session session, {required String id}) async {
    final Response<Object?> response = await _sendOrQueue(
      session: session,
      method: 'DELETE',
      path: '/api/mobile/grocery/$id',
    );

    if (_wasQueued(response)) return;
    _guard(response, expected: 200);
  }

  Future<int> clearChecked(Session session) async {
    final Response<Object?> response = await _sendOrQueue(
      session: session,
      method: 'POST',
      path: '/api/mobile/grocery/clear-checked',
      body: <String, Object?>{},
    );

    if (_wasQueued(response)) return 0;
    _guard(response, expected: 200);
    final Map<String, Object?> body = _extractMap(response);
    return body['deleted'] is int ? body['deleted']! as int : 0;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

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
      throw const GroceryCapReachedException();
    }
  }

  bool _wasQueued(Response<Object?> response) {
    if ((response.statusCode ?? 0) != 202) return false;
    final Object? data = response.data;
    if (data is! Map) return false;
    return (data as Map<Object?, Object?>)['queued'] == true;
  }

  /// Used by mutation paths that operate on a raw [Response].
  void _guard(Response<Object?> response, {required int expected}) {
    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const GrocerySessionRevokedException();
    }
    if (status == 404) {
      throw const GroceryNotFoundException();
    }
    if (status == 400) {
      final String code = _errorCode(response.data);
      if (code == 'TOO_MANY_ITEMS') {
        throw const GroceryCapReachedException();
      }
      throw GroceryFetchException('400 $code');
    }
    if (status != expected) {
      throw GroceryFetchException('Unexpected status $status');
    }
  }

  /// Used by [fetchAll] which goes through [CachedGet] and only has a plain
  /// int status code.
  void _guardStatusInt(int status) {
    if (status == 401) {
      throw const GrocerySessionRevokedException();
    }
    if (status == 404) {
      throw const GroceryNotFoundException();
    }
    if (status != 200) {
      throw GroceryFetchException('Unexpected status $status');
    }
  }

  String _errorCode(Object? data) {
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
      throw const GroceryFetchException('Unexpected response format');
    }
    return (data as Map<Object?, Object?>).cast<String, Object?>();
  }
}
