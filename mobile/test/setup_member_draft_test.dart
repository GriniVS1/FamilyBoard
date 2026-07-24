// Regression test for `buildMembersPayload` — must trim names and drop
// blank drafts before they ever reach `POST /api/setup/members` (whose
// `memberSchema` rejects an empty `name`), and must never send a `role`
// field (the wall auto-assigns the first member ADMIN when none is given).

import 'package:familyboard_mobile/models/setup_member_draft.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('builds one entry per non-blank draft, trimming names', () {
    final List<Map<String, Object?>> payload = buildMembersPayload(
      const <SetupMemberDraft>[
        SetupMemberDraft(name: '  Mia  ', color: 'peach', emoji: '👧'),
        SetupMemberDraft(name: 'Noah', color: 'sky', emoji: '👦'),
      ],
    );

    expect(payload, hasLength(2));
    expect(
        payload[0],
        equals(<String, Object?>{
          'name': 'Mia',
          'color': 'peach',
          'emoji': '👧',
        }));
    expect(payload[1]['name'], equals('Noah'));
    expect(payload.every((Map<String, Object?> m) => !m.containsKey('role')),
        isTrue);
  });

  test('drops drafts with a blank or whitespace-only name', () {
    final List<Map<String, Object?>> payload = buildMembersPayload(
      const <SetupMemberDraft>[
        SetupMemberDraft(name: '', color: 'peach', emoji: '👧'),
        SetupMemberDraft(name: '   ', color: 'sky', emoji: '👦'),
        SetupMemberDraft(name: 'Mia', color: 'mint', emoji: '🦊'),
      ],
    );

    expect(payload, hasLength(1));
    expect(payload.single['name'], equals('Mia'));
  });

  test('an all-blank list builds an empty payload', () {
    final List<Map<String, Object?>> payload = buildMembersPayload(
      const <SetupMemberDraft>[
        SetupMemberDraft(name: '  ', color: 'peach', emoji: '👧')
      ],
    );
    expect(payload, isEmpty);
  });
}
