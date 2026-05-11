import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/session.dart';
import '../services/api_client.dart';
import '../services/heartbeat_service.dart';
import '../services/pair_service.dart';
import '../services/secure_storage.dart';

final Provider<ApiClientFactory> apiClientFactoryProvider =
    Provider<ApiClientFactory>((Ref ref) => const ApiClientFactory());

final Provider<SecureSessionStore> sessionStoreProvider =
    Provider<SecureSessionStore>((Ref ref) => SecureSessionStore());

final Provider<PairService> pairServiceProvider = Provider<PairService>(
  (Ref ref) => PairService(clientFactory: ref.watch(apiClientFactoryProvider)),
);

final Provider<HeartbeatService> heartbeatServiceProvider =
    Provider<HeartbeatService>(
  (Ref ref) =>
      HeartbeatService(clientFactory: ref.watch(apiClientFactoryProvider)),
);

class SessionState {
  const SessionState({required this.loaded, required this.session});

  const SessionState.loading()
      : loaded = false,
        session = null;

  const SessionState.none()
      : loaded = true,
        session = null;

  const SessionState.signedIn(Session session)
      : loaded = true,
        session = session;

  final bool loaded;
  final Session? session;

  bool get hasSession => session != null;
}

class SessionNotifier extends Notifier<SessionState> {
  @override
  SessionState build() {
    Future<void>.microtask(_load);
    return const SessionState.loading();
  }

  Future<void> _load() async {
    final Session? stored = await ref.read(sessionStoreProvider).read();
    state = stored == null
        ? const SessionState.none()
        : SessionState.signedIn(stored);
  }

  Future<void> adopt(Session session) async {
    await ref.read(sessionStoreProvider).write(session);
    state = SessionState.signedIn(session);
  }

  Future<void> clear() async {
    await ref.read(sessionStoreProvider).clear();
    state = const SessionState.none();
  }
}

final NotifierProvider<SessionNotifier, SessionState> sessionProvider =
    NotifierProvider<SessionNotifier, SessionState>(SessionNotifier.new);
