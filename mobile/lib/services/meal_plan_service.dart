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
}
