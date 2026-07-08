import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/calendar_setup.dart';
import '../services/calendar_setup_service.dart';
import 'session_provider.dart';

final FutureProvider<CalendarStatus> calendarStatusProvider =
    FutureProvider<CalendarStatus>((Ref ref) async {
  final SessionState sessionState = ref.watch(sessionProvider);
  final session = sessionState.session;
  if (session == null) {
    throw const CalendarSetupSessionRevokedException();
  }
  return ref.watch(calendarSetupServiceProvider).fetchStatus(session);
});
