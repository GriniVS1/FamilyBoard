import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/meal_plan.dart';
import '../services/meal_plan_service.dart';
import 'session_provider.dart';

final FutureProvider<List<MealPlan>> mealPlanProvider =
    FutureProvider<List<MealPlan>>((Ref ref) async {
  final SessionState sessionState = ref.watch(sessionProvider);
  final session = sessionState.session;
  if (session == null) {
    throw const MealPlanFetchException('No active session');
  }
  return ref.watch(mealPlanServiceProvider).fetchWeek(session);
});
