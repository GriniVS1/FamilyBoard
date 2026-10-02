import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/chores_service.dart';
import 'session_provider.dart';

/// Fetches the family-wide chore list (all members, includes `member` and
/// `completedTodayBy` per chore). Backs the Aufgaben board and the Heute
/// Ämtli card.
///
/// Callers can trigger a manual refresh via `ref.invalidate(choresProvider)`.
final FutureProvider<ChoresResult> choresProvider =
    FutureProvider<ChoresResult>((Ref ref) async {
      final SessionState sessionState = ref.watch(sessionProvider);
      final session = sessionState.session;
      if (session == null) {
        throw const ChoresFetchException('No active session');
      }
      return ref.watch(choresServiceProvider).fetchChores(session);
    });
