/// POD models for the `GET /api/mobile/chores` response — the family-wide
/// chore list backing the Tasks screen's Ämtli segment.
///
/// Distinct from [TodayChore] (`models/today.dart`), which is member-scoped
/// and comes from `/api/mobile/today`. This model carries every chore
/// defined for the family, its assignee (nullable), and who completed it
/// today (nullable, may differ from the assignee if the wall lets anyone
/// mark a chore done).
library;

class ChoreMember {
  const ChoreMember({
    required this.id,
    required this.name,
    required this.color,
    required this.emoji,
  });

  factory ChoreMember.fromJson(Map<String, Object?> json) {
    return ChoreMember(
      id: json['id']! as String,
      name: json['name']! as String,
      color: json['color']! as String,
      emoji: json['emoji'] is String ? json['emoji']! as String : '',
    );
  }

  final String id;
  final String name;

  /// One of the 8 accent names ("peach", "mint", …).
  final String color;
  final String emoji;
}

class Chore {
  const Chore({
    required this.id,
    required this.title,
    required this.icon,
    required this.points,
    required this.rrule,
    required this.memberId,
    required this.member,
    required this.completedToday,
    required this.completedTodayBy,
  });

  factory Chore.fromJson(Map<String, Object?> json) {
    final Object? memberIdRaw = json['memberId'];
    final Object? memberRaw = json['member'];
    final Object? completedByRaw = json['completedTodayBy'];
    return Chore(
      id: json['id']! as String,
      title: json['title']! as String,
      icon: json['icon'] is String ? json['icon']! as String : null,
      points: json['points'] is int ? json['points']! as int : 0,
      rrule: json['rrule'] is String ? json['rrule']! as String : null,
      memberId: memberIdRaw is String ? memberIdRaw : null,
      member: memberRaw is Map
          ? ChoreMember.fromJson(
              (memberRaw as Map<Object?, Object?>).cast<String, Object?>(),
            )
          : null,
      completedToday: json['completedToday'] == true,
      completedTodayBy: completedByRaw is Map
          ? ChoreMember.fromJson(
              (completedByRaw as Map<Object?, Object?>).cast<String, Object?>(),
            )
          : null,
    );
  }

  final String id;
  final String title;

  /// Raw emoji string or null.
  final String? icon;
  final int points;
  final String? rrule;

  /// Null when the chore is unassigned (open to the whole family).
  final String? memberId;
  final ChoreMember? member;
  final bool completedToday;

  /// Who completed the chore today, if anyone. May differ from [member] —
  /// any family member can mark an unassigned (or someone else's) chore done.
  final ChoreMember? completedTodayBy;
}
