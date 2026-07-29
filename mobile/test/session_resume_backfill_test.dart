// Regression coverage for the app-first-onboarded-phones-offline-on-cellular
// field bug: `SessionNotifier._onResumed` must keep retrying the identity
// backfill on every resume until `Session.remoteUrl` lands, since the
// post-pair fetch in `adoptPairedSession` (or the wall's `setup/pin`
// response) can miss it once (relay tunnel not up yet, flaky network).
//
// `shouldBackfillRemoteUrl` is the pure decision extracted out of
// `_onResumed` specifically so this doesn't require standing up a full
// `ProviderContainer` + `WidgetsBinding` + platform-channel plugins
// (`connectivity_plus`, `flutter_secure_storage`) the way exercising the
// real `SessionNotifier` would — see `test/tasks_screen_widget_test.dart`,
// which fakes `SessionNotifier` outright rather than running the real one.
// The wiring itself (calling `_backfillFromIdentity` exactly when this
// returns true, fire-and-forget, no retry timer) is documented in
// `_onResumed`'s doc comment and reviewed by inspection.

import 'package:familyboard_mobile/models/session.dart';
import 'package:familyboard_mobile/state/session_provider.dart';
import 'package:flutter_test/flutter_test.dart';

Session _session({String? remoteUrl}) => Session(
  serverUrl: 'http://192.168.1.50:3000',
  token: 'tok',
  deviceId: 'device_1',
  member: const Member(id: 'm', name: 'Alex', color: 'sky', emoji: '🧑'),
  family: const Family(id: 'f', name: 'The Family'),
  remoteUrl: remoteUrl,
);

void main() {
  group('shouldBackfillRemoteUrl', () {
    test('no session at all — nothing to backfill', () {
      expect(shouldBackfillRemoteUrl(null), isFalse);
    });

    test('session missing remoteUrl — should attempt a backfill', () {
      expect(shouldBackfillRemoteUrl(_session(remoteUrl: null)), isTrue);
    });

    test('session already has a remoteUrl — no-op, no repeat fetch', () {
      expect(
        shouldBackfillRemoteUrl(
          _session(remoteUrl: 'https://relay.familyboard.ch/f/abc123'),
        ),
        isFalse,
      );
    });
  });
}
