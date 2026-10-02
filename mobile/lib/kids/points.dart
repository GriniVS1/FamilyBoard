/// What the star counter next to a person shows (R6.2).
///
/// The ruling wants the **balance** (all points since the parents' last
/// reset). The mobile API cannot deliver it yet (dependency A1,
/// `/api/mobile/points` is not live), so [StarScope.today] is the best honest
/// number: the stars a person earned today, counted from the family chore
/// list. [StarCount.scope] tells the UI which of the two it is showing, and
/// the counter is labelled accordingly. When A1 lands, only `starCountProvider`
/// (state/stars_provider.dart) changes: it returns [StarScope.balance] and the
/// widget drops the "heute" label on its own.
library;

import '../models/chore.dart';

enum StarScope {
  /// Stars earned since midnight (placeholder until A1 is live).
  today,

  /// Stars since the last reset by the parents (R6.2, needs A1).
  balance,
}

class StarCount {
  const StarCount({required this.value, required this.scope});

  final int value;
  final StarScope scope;
}

/// Stars [memberId] earned today. [isDone] is the optimistic answer;
/// [doerOf] says who ticked a done chore (the session person for anything
/// the app ticked itself, else the server's `completedTodayBy`).
///
/// The server reports only the latest completion of a chore per day, so a
/// chore finished by two people counts for the later one.
int starsEarnedToday({
  required String memberId,
  required Iterable<Chore> chores,
  required bool Function(Chore chore) isDone,
  required String? Function(Chore chore) doerOf,
}) {
  int total = 0;
  for (final Chore chore in chores) {
    if (isDone(chore) && doerOf(chore) == memberId) {
      total += chore.points;
    }
  }
  return total;
}
