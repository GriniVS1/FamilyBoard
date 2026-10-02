import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderFamily;

import '../kids/points.dart';
import '../models/chore.dart';
import '../services/chores_service.dart';
import 'chore_actions.dart';
import 'chores_provider.dart';
import 'session_provider.dart';

/// Star counter of one person, or null while the chores load (the UI then
/// shows a skeleton, never "0").
///
/// Data source today: stars earned today, derived from [choresProvider] plus
/// the optimistic [choreActionsProvider]. Switching to the real balance (A1)
/// means replacing this body; see `kids/points.dart`.
final ProviderFamily<StarCount?, String> starCountProvider =
    Provider.family<StarCount?, String>((Ref ref, String memberId) {
      final ChoresResult? result = ref.watch(choresProvider).value;
      if (result == null) {
        return null;
      }
      final ChoreActionsState actions = ref.watch(choreActionsProvider);
      final String? sessionMemberId = ref
          .watch(sessionProvider)
          .session
          ?.member
          .id;
      final int value = starsEarnedToday(
        memberId: memberId,
        chores: result.chores,
        isDone: actions.isDone,
        doerOf: (Chore chore) => actions[chore.id] != null
            ? sessionMemberId
            : chore.completedTodayBy?.id,
      );
      return StarCount(value: value, scope: StarScope.today);
    });
