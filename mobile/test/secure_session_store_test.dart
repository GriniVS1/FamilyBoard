// Session-storage compatibility regression test for the
// flutter_secure_storage v9 -> v10 upgrade (see CHANGELOG.md "Migration from
// Version 9.x"): v10 replaced Android's `encryptedSharedPreferences` cipher
// with custom AES-GCM/RSA-OAEP ciphers and auto-migrates existing v9 data in
// place via `migrateOnAlgorithmChange` (default true) — that native
// migration itself isn't reachable from a Dart-only test. What *is* on our
// side of the boundary, and what this guards, is the public contract
// `SecureSessionStore` relies on: the storage key never changed
// (`familyboard.session.v1`) and a value written under the old
// `AndroidOptions(encryptedSharedPreferences: true)` shape (a plain
// `Session.encode()` string — the cipher is transparent below the platform
// interface) still round-trips correctly now that the option has been
// removed in favour of v10's default `AndroidOptions()`.
import 'package:familyboard_mobile/models/session.dart';
import 'package:familyboard_mobile/services/secure_storage.dart';
import 'package:flutter_secure_storage/test/test_flutter_secure_storage_platform.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';

Session _session() => const Session(
      serverUrl: 'http://192.168.1.10:3000',
      token: 'device-token',
      deviceId: 'device_1',
      member: Member(id: 'member_1', name: 'Alex', color: 'sky', emoji: '🧑'),
      family: Family(id: 'family_1', name: 'The Family'),
    );

void main() {
  test(
    'a session persisted before the v10 upgrade is still readable through '
    'SecureSessionStore.read() with no data loss',
    () async {
      final Session original = _session();
      // Simulates data already sitting in the platform store from before
      // this upgrade — the pre-upgrade code path wrote the same
      // `Session.encode()` string, just under
      // `AndroidOptions(encryptedSharedPreferences: true)`. The cipher
      // change lives entirely in the native layer below this fake.
      final TestFlutterSecureStoragePlatform fakePlatform =
          TestFlutterSecureStoragePlatform(<String, String>{
        'familyboard.session.v1': original.encode(),
      });
      FlutterSecureStoragePlatform.instance = fakePlatform;

      final SecureSessionStore store = SecureSessionStore();
      final Session? read = await store.read();

      expect(read, isNotNull);
      expect(read!.serverUrl, equals(original.serverUrl));
      expect(read.token, equals(original.token));
      expect(read.deviceId, equals(original.deviceId));
      expect(read.member.id, equals(original.member.id));
      expect(read.family.id, equals(original.family.id));
    },
  );

  test(
    'write() then read() round-trips under the v10 default AndroidOptions()',
    () async {
      FlutterSecureStoragePlatform.instance =
          TestFlutterSecureStoragePlatform(<String, String>{});

      final SecureSessionStore store = SecureSessionStore();
      final Session original = _session();
      await store.write(original);

      final Session? read = await store.read();

      expect(read, isNotNull);
      expect(read!.token, equals(original.token));
    },
  );

  test('clear() removes the session key', () async {
    final TestFlutterSecureStoragePlatform fakePlatform =
        TestFlutterSecureStoragePlatform(<String, String>{
      'familyboard.session.v1': _session().encode(),
    });
    FlutterSecureStoragePlatform.instance = fakePlatform;

    final SecureSessionStore store = SecureSessionStore();
    await store.clear();

    expect(await store.read(), isNull);
  });
}
