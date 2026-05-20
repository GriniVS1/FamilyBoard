import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/today.dart';
import '../services/today_service.dart';
import 'session_provider.dart';

/// Fetches today's data for the current session member.
///
/// Auto-rebuilds when the session changes. Callers can trigger a manual
/// refresh via `ref.invalidate(todayProvider)`.
final FutureProvider<TodayPayload> todayProvider =
    FutureProvider<TodayPayload>((Ref ref) async {
  final SessionState sessionState = ref.watch(sessionProvider);
  final session = sessionState.session;
  if (session == null) {
    throw const TodayFetchException('No active session');
  }
  return ref.watch(todayServiceProvider).fetchToday(session);
});
