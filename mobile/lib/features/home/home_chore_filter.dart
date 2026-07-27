import '../../models/today.dart';

/// Filters the Home Ämtli card down to what's relevant for the signed-in
/// member: their own assigned chores, plus unassigned chores.
///
/// Unassigned chores (`memberId == null`) deliberately stay visible to
/// everyone — a chore with no assignee would otherwise vanish from every
/// family member's home screen and nobody would ever see it there. The full,
/// unfiltered family list is always one tap away via the Tasks screen
/// (`/tasks`, see `features/tasks/tasks_screen.dart`).
List<TodayChore> filterHomeChores(
  List<TodayChore> chores,
  String sessionMemberId,
) {
  return chores
      .where(
        (TodayChore chore) =>
            chore.memberId == null || chore.memberId == sessionMemberId,
      )
      .toList();
}
