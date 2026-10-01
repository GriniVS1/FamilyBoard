// Drives the real SessionNotifier through AppLifecycleState transitions and
// asserts on the 30s poll timer. Regression for iPhone Duo Split View, which
// parks visible apps in `inactive`: the poll must survive `inactive` and only
// stop on paused / hidden / detached.

import 'package:familyboard_mobile/models/session.dart';
import 'package:familyboard_mobile/services/secure_storage.dart';
import 'package:familyboard_mobile/state/connectivity_provider.dart';
import 'package:familyboard_mobile/state/session_provider.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const Session _session = Session(
  serverUrl: 'http://192.168.1.50:3000',
  token: 'tok',
  deviceId: 'device_1',
  member: Member(id: 'm', name: 'Alex', color: 'sky', emoji: '🧑'),
  family: Family(id: 'f', name: 'The Family'),
  installationId: 'inst_1',
  remoteUrl: 'https://relay.familyboard.ch/f/abc123',
);

class _FakeStore implements SecureSessionStore {
  @override
  Future<Session?> read() async => _session;

  @override
  Future<void> write(Session session) async {}

  @override
  Future<void> clear() async {}
}

void main() {
  final TestWidgetsFlutterBinding binding =
      TestWidgetsFlutterBinding.ensureInitialized();

  late ProviderContainer container;

  setUp(() async {
    container = ProviderContainer(
      overrides: [
        sessionStoreProvider.overrideWithValue(_FakeStore()),
        wifiConnectivityProvider.overrideWith(
          (Ref ref) => Stream<bool>.value(false),
        ),
      ],
    );
    addTearDown(container.dispose);
    container.read(sessionProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
  });

  bool polling() => container.read(sessionProvider.notifier).isPolling;

  test('signed-in session starts the poll on cold start', () {
    expect(container.read(sessionProvider).hasSession, isTrue);
    expect(polling(), isTrue);
  });

  test('inactive keeps the poll running (Split View / transient dialogs)', () {
    binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    expect(polling(), isTrue);
  });

  test('paused, hidden and detached stop the poll', () {
    for (final AppLifecycleState state in <AppLifecycleState>[
      AppLifecycleState.paused,
      AppLifecycleState.hidden,
      AppLifecycleState.detached,
    ]) {
      binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      expect(polling(), isTrue, reason: 'armed before $state');
      binding.handleAppLifecycleStateChanged(state);
      expect(polling(), isFalse, reason: '$state must stop the poll');
    }
  });

  test('returning to inactive from hidden re-arms the poll', () {
    binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    expect(polling(), isFalse);
    binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    expect(polling(), isTrue);
  });
}
