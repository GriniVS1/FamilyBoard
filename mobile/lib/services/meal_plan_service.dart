import 'package:dio/dio.dart';

import '../models/meal_plan.dart';
import '../models/session.dart';
import 'api_client.dart';

class MealPlanSessionRevokedException implements Exception {
  const MealPlanSessionRevokedException();
}

class MealPlanFetchException implements Exception {
  const MealPlanFetchException(this.message);

  final String message;
}

class MealPlanGroceryCapReachedException implements Exception {
  const MealPlanGroceryCapReachedException();
}

class MealPlanNotFoundException implements Exception {
  const MealPlanNotFoundException();
}

class MealPlanService {
  MealPlanService({required ApiClientFactory clientFactory})
      : _clientFactory = clientFactory;

  final ApiClientFactory _clientFactory;

  Future<List<MealPlan>> fetchWeek(Session session, {DateTime? week}) async {
    final Map<String, Object?> queryParams = <String, Object?>{};
    if (week != null) {
      queryParams['week'] =
          '${week.year.toString().padLeft(4, '0')}-${week.month.toString().padLeft(2, '0')}-${week.day.toString().padLeft(2, '0')}';
    }
    final Dio dio = _clientFactory.authenticated(session);
    final Response<Object?> response;
    try {
      response = await dio.get<Object?>(
        '/api/mobile/meals',
        queryParameters: queryParams.isEmpty ? null : queryParams,
      );
    } on DioException catch (e) {
      throw MealPlanFetchException('Network error: ${e.message}');
    }
    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const MealPlanSessionRevokedException();
    }
    if (status != 200) {
      throw MealPlanFetchException('Unexpected status $status');
    }
    final Object? data = response.data;
    if (data is! Map) {
      throw const MealPlanFetchException('Unexpected response format');
    }
    final Map<String, Object?> body =
        (data as Map<Object?, Object?>).cast<String, Object?>();
    final Object? rawItems = body['plans'];
    if (rawItems is! List) {
      throw const MealPlanFetchException('Unexpected response format');
    }
    return rawItems
        .whereType<Map<Object?, Object?>>()
        .map((Map<Object?, Object?> m) =>
            MealPlan.fromJson(m.cast<String, Object?>()))
        .toList();
  }

  Future<MealPlan> upsert(
    Session session, {
    required DateTime date,
    required MealSlot slot,
    required String customName,
    String? notes,
    String? memberId,
  }) async {
    final String dateStr =
        '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    final Map<String, Object?> payload = <String, Object?>{
      'date': dateStr,
      'slot': slot.name.toUpperCase(),
      'customName': customName,
      if (notes != null) 'notes': notes,
      if (memberId != null) 'memberId': memberId,
    };
    final Dio dio = _clientFactory.authenticated(session);
    final Response<Object?> response;
    try {
      response = await dio.post<Object?>('/api/mobile/meals', data: payload);
    } on DioException catch (e) {
      throw MealPlanFetchException('Network error: ${e.message}');
    }
    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const MealPlanSessionRevokedException();
    }
    if (status != 200) {
      throw MealPlanFetchException('Unexpected status $status');
    }
    return _parseMealPlan(response);
  }

  Future<MealPlan> patch(
    Session session, {
    required String id,
    DateTime? date,
    MealSlot? slot,
    String? customName,
    String? notes,
    String? memberId,
  }) async {
    final Map<String, Object?> payload = <String, Object?>{
      if (date != null)
        'date':
            '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
      if (slot != null) 'slot': slot.name.toUpperCase(),
      if (customName != null) 'customName': customName,
      if (notes != null) 'notes': notes,
      if (memberId != null) 'memberId': memberId,
    };
    final Dio dio = _clientFactory.authenticated(session);
    final Response<Object?> response;
    try {
      response =
          await dio.patch<Object?>('/api/mobile/meals/$id', data: payload);
    } on DioException catch (e) {
      throw MealPlanFetchException('Network error: ${e.message}');
    }
    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const MealPlanSessionRevokedException();
    }
    if (status == 404) {
      throw const MealPlanNotFoundException();
    }
    if (status != 200) {
      throw MealPlanFetchException('Unexpected status $status');
    }
    return _parseMealPlan(response);
  }

  Future<void> delete(Session session, {required String id}) async {
    final Dio dio = _clientFactory.authenticated(session);
    final Response<Object?> response;
    try {
      response = await dio.delete<Object?>('/api/mobile/meals/$id');
    } on DioException catch (e) {
      throw MealPlanFetchException('Network error: ${e.message}');
    }
    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const MealPlanSessionRevokedException();
    }
    if (status == 404) {
      throw const MealPlanNotFoundException();
    }
    if (status != 200) {
      throw MealPlanFetchException('Unexpected status $status');
    }
  }

  MealPlan _parseMealPlan(Response<Object?> response) {
    final Object? data = response.data;
    if (data is! Map) {
      throw const MealPlanFetchException('Unexpected response format');
    }
    final Map<String, Object?> body =
        (data as Map<Object?, Object?>).cast<String, Object?>();
    return MealPlan.fromJson(body);
  }

  Future<int> generateGroceryFromWeek(
    Session session, {
    required DateTime startDate,
  }) async {
    final String dateStr =
        '${startDate.year.toString().padLeft(4, '0')}-${startDate.month.toString().padLeft(2, '0')}-${startDate.day.toString().padLeft(2, '0')}';
    final Dio dio = _clientFactory.authenticated(session);
    final Response<Object?> response;
    try {
      response = await dio.post<Object?>(
        '/api/mobile/grocery/from-week',
        data: <String, Object?>{'startDate': dateStr},
      );
    } on DioException catch (e) {
      throw MealPlanFetchException('Network error: ${e.message}');
    }
    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const MealPlanSessionRevokedException();
    }
    if (status == 400) {
      final Object? data = response.data;
      if (data is Map) {
        final Object? error = (data as Map<Object?, Object?>)['error'];
        if (error is Map) {
          final Object? code = (error as Map<Object?, Object?>)['code'];
          if (code == 'TOO_MANY_ITEMS') {
            throw const MealPlanGroceryCapReachedException();
          }
        }
      }
      throw const MealPlanFetchException('400 error');
    }
    if (status != 200) {
      throw MealPlanFetchException('Unexpected status $status');
    }
    final Object? data = response.data;
    if (data is! Map) {
      throw const MealPlanFetchException('Unexpected response format');
    }
    final Map<String, Object?> body =
        (data as Map<Object?, Object?>).cast<String, Object?>();
    final Object? count = body['count'];
    return count is int ? count : 0;
  }
}
