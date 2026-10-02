import '../../kids/chore_state.dart';

/// Filters the Heute Ämtli card down to what's relevant for the signed-in
/// member: their own assigned chores, plus unassigned chores.
///
/// Unassigned chores (`memberId == null`) deliberately stay visible to
/// everyone - a chore with no assignee would otherwise vanish from every
/// family member's Heute screen and nobody would ever see it there. The full,
/// unfiltered family list is always one tap away on the Aufgaben tab.
List<T> filterHomeChores<T extends ChoreLike>(
  List<T> chores,
  String sessionMemberId,
) {
  return chores
      .where(
        (T chore) =>
            chore.memberId == null || chore.memberId == sessionMemberId,
      )
      .toList();
}
