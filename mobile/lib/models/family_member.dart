/// POD models for the `/api/mobile/members` endpoints.
library;

enum MemberRole { admin, member }

MemberRole memberRoleFromJson(Object? raw) {
  return raw == 'ADMIN' ? MemberRole.admin : MemberRole.member;
}

String memberRoleToJson(MemberRole role) {
  return role == MemberRole.admin ? 'ADMIN' : 'MEMBER';
}

class FamilyMember {
  const FamilyMember({
    required this.id,
    required this.name,
    required this.color,
    required this.emoji,
    required this.role,
  });

  factory FamilyMember.fromJson(Map<String, Object?> json) {
    return FamilyMember(
      id: json['id']! as String,
      name: json['name']! as String,
      color: json['color']! as String,
      emoji: json['emoji'] is String ? json['emoji']! as String : '',
      role: memberRoleFromJson(json['role']),
    );
  }

  final String id;
  final String name;

  /// One of the 8 accent names ("peach", "mint", …).
  final String color;
  final String emoji;
  final MemberRole role;
}

/// The `me` field of `GET /api/mobile/members` — the acting device's own
/// member id and role, used to gate the add/edit/delete UI to admins.
class CurrentMember {
  const CurrentMember({required this.memberId, required this.role});

  factory CurrentMember.fromJson(Map<String, Object?> json) {
    return CurrentMember(
      memberId: json['memberId']! as String,
      role: memberRoleFromJson(json['role']),
    );
  }

  final String memberId;
  final MemberRole role;
}

class MembersResult {
  const MembersResult({required this.members, required this.me});

  factory MembersResult.fromJson(Map<String, Object?> json) {
    final Object? membersRaw = json['members'];
    final List<FamilyMember> members = membersRaw is List
        ? membersRaw
            .whereType<Map<Object?, Object?>>()
            .map((Map<Object?, Object?> m) =>
                FamilyMember.fromJson(m.cast<String, Object?>()))
            .toList()
        : <FamilyMember>[];
    final Map<String, Object?> meJson =
        (json['me']! as Map<Object?, Object?>).cast<String, Object?>();
    return MembersResult(members: members, me: CurrentMember.fromJson(meJson));
  }

  final List<FamilyMember> members;
  final CurrentMember me;

  bool get isAdmin => me.role == MemberRole.admin;
}
