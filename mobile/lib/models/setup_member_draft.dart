/// In-memory draft of a family member being created during app-first
/// onboarding, before `POST /api/setup/members` assigns it a real id. Unlike
/// [FamilyMember] this never round-trips through the server on its own.
library;

class SetupMemberDraft {
  const SetupMemberDraft({
    required this.name,
    required this.color,
    required this.emoji,
  });

  final String name;

  /// One of the 8 accent names ("peach", "mint", …).
  final String color;
  final String emoji;

  SetupMemberDraft copyWith({String? name, String? color, String? emoji}) {
    return SetupMemberDraft(
      name: name ?? this.name,
      color: color ?? this.color,
      emoji: emoji ?? this.emoji,
    );
  }

  Map<String, Object?> toJson() => <String, Object?>{
        'name': name,
        'color': color,
        'emoji': emoji,
      };
}

/// Builds the `POST /api/setup/members` request body from onboarding drafts.
///
/// Trims names and drops blank drafts — the wall's `memberSchema` rejects an
/// empty `name`, so filtering here avoids a round trip that would only come
/// back as `VALIDATION_ERROR`. The wall assigns the first member `ADMIN`
/// automatically when no explicit `role` is sent (see
/// `src/app/api/setup/members/route.ts`), so drafts never carry a role.
List<Map<String, Object?>> buildMembersPayload(List<SetupMemberDraft> drafts) {
  return drafts
      .map((SetupMemberDraft d) => d.copyWith(name: d.name.trim()))
      .where((SetupMemberDraft d) => d.name.isNotEmpty)
      .map((SetupMemberDraft d) => d.toJson())
      .toList();
}
