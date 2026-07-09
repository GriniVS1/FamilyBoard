// Regression test for the `/api/mobile/members` response parsing — a subset
// of members plus the acting device's own member id + role.

import 'package:familyboard_mobile/models/family_member.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('MembersResult.fromJson parses members and me', () {
    final MembersResult result = MembersResult.fromJson(<String, Object?>{
      'members': <Object?>[
        <String, Object?>{
          'id': 'm1',
          'name': 'Mia',
          'color': 'sky',
          'emoji': '🦊',
          'role': 'ADMIN',
        },
        <String, Object?>{
          'id': 'm2',
          'name': 'Leo',
          'color': 'mint',
          'emoji': '🐻',
          'role': 'MEMBER',
        },
      ],
      'me': <String, Object?>{'memberId': 'm2', 'role': 'MEMBER'},
    });

    expect(result.members, hasLength(2));
    expect(result.members.first.name, equals('Mia'));
    expect(result.members.first.role, equals(MemberRole.admin));
    expect(result.members.last.role, equals(MemberRole.member));
    expect(result.me.memberId, equals('m2'));
    expect(result.isAdmin, isFalse);
  });

  test('memberRoleFromJson defaults unknown values to member', () {
    expect(memberRoleFromJson('ADMIN'), equals(MemberRole.admin));
    expect(memberRoleFromJson('MEMBER'), equals(MemberRole.member));
    expect(memberRoleFromJson(null), equals(MemberRole.member));
    expect(memberRoleFromJson('bogus'), equals(MemberRole.member));
  });

  test('memberRoleToJson round-trips', () {
    expect(memberRoleToJson(MemberRole.admin), equals('ADMIN'));
    expect(memberRoleToJson(MemberRole.member), equals('MEMBER'));
  });
}
