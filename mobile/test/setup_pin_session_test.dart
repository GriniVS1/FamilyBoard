// Regression test for `SetupPinSession.fromJson` — the parser for the
// `session` object nested in `POST /api/setup/pin`'s response when the
// request included `device` (see `src/app/api/setup/pin/route.ts`). This is
// what lets app-first onboarding finish signed in instead of falling into a
// separate "who are you?" step.

import 'package:familyboard_mobile/services/setup_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses the exact shape POST /api/setup/pin returns', () {
    final SetupPinSession result = SetupPinSession.fromJson(<String, Object?>{
      'token': 'raw-device-token',
      'deviceId': 'device_1',
      'member': <String, Object?>{
        'id': 'member_1',
        'name': 'Alex',
        'color': 'sky',
        'emoji': '🧑',
      },
      'family': <String, Object?>{'id': 'family_1', 'name': 'The Family'},
    });

    expect(result.token, equals('raw-device-token'));
    expect(result.deviceId, equals('device_1'));
    expect(result.member.id, equals('member_1'));
    expect(result.member.name, equals('Alex'));
    expect(result.member.color, equals('sky'));
    expect(result.member.emoji, equals('🧑'));
    expect(result.family.id, equals('family_1'));
    expect(result.family.name, equals('The Family'));
  });

  test('treats a missing member emoji as empty (mirrors Member.fromJson)', () {
    final SetupPinSession result = SetupPinSession.fromJson(<String, Object?>{
      'token': 't',
      'deviceId': 'd',
      'member': <String, Object?>{'id': 'm', 'name': 'Sam', 'color': 'mint'},
      'family': <String, Object?>{'id': 'f', 'name': 'Fam'},
    });
    expect(result.member.emoji, equals(''));
  });
}
