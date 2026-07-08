import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../db/cache_db.dart';
import '../models/session.dart';
import '../services/api_client.dart';
import '../services/calendar_setup_service.dart';
import '../services/connection_recovery_service.dart';
import '../services/events_service.dart';
import '../services/fcm_service.dart';
import '../services/grocery_service.dart';
import '../services/heartbeat_service.dart';
import '../services/identity_service.dart';
import '../services/meal_plan_service.dart';
import '../services/members_service.dart';
import '../services/mutations_service.dart';
import '../services/notes_service.dart';
import '../services/pair_service.dart';
import '../services/secure_storage.dart';
import '../services/today_service.dart';
import '../services/write_queue_service.dart';

final Provider<SecureSessionStore> sessionStoreProvider =
    Provider<SecureSessionStore>((Ref ref) => SecureSessionStore());

/// Unauthenticated identity probe (`GET /api/mobile/identity`) — used after
/// pairing and during connection recovery. Kept separate from
/// [apiClientFactoryProvider] so it never recurses through the recovery hook
/// it is itself used to implement.
final Provider<IdentityService> identityServiceProvider =
    Provider<IdentityService>((Ref ref) => IdentityService());

/// Finds the wall again on the LAN (alt URL, then mDNS) when its IP changes.
final Provider<ConnectionRecoveryService> connectionRecoveryServiceProvider =
    Provider<ConnectionRecoveryService>(
  (Ref ref) => ConnectionRecoveryService(
    identityService: ref.watch(identityServiceProvider),
  ),
);

/// Wires [ApiClientFactory]'s error-interceptor recovery hook to
/// [ConnectionRecoveryService] + [SessionNotifier], so a rediscovered URL is
/// persisted before the failed request is retried against it.
final Provider<ApiClientFactory> apiClientFactoryProvider =
    Provider<ApiClientFactory>((Ref ref) {
  return ApiClientFactory(
    recovery: (Session session) async {
      final RecoveredConnection? recovered =
          await ref.read(connectionRecoveryServiceProvider).recover(session);
      if (recovered == null) {
        return null;
      }
      await ref
          .read(sessionProvider.notifier)
          .applyRecoveredConnection(recovered);
      return recovered.serverUrl;
    },
  );
});

final Provider<CacheDb> cacheDbProvider =
    Provider<CacheDb>((_) => CacheDb.instance);

final Provider<PairService> pairServiceProvider = Provider<PairService>(
  (Ref ref) => PairService(clientFactory: ref.watch(apiClientFactoryProvider)),
);

final Provider<HeartbeatService> heartbeatServiceProvider =
    Provider<HeartbeatService>(
  (Ref ref) =>
      HeartbeatService(clientFactory: ref.watch(apiClientFactoryProvider)),
);

final Provider<FcmService> fcmServiceProvider = Provider<FcmService>(
  (Ref ref) => FcmService(clientFactory: ref.watch(apiClientFactoryProvider)),
);

final Provider<WriteQueueService> writeQueueServiceProvider =
    Provider<WriteQueueService>(
  (Ref ref) => WriteQueueService(
    db: ref.watch(cacheDbProvider),
    clientFactory: ref.watch(apiClientFactoryProvider),
  ),
);

final Provider<MutationsService> mutationsServiceProvider =
    Provider<MutationsService>(
  (Ref ref) => MutationsService(
    writeQueueService: ref.watch(writeQueueServiceProvider),
  ),
);

final Provider<TodayService> todayServiceProvider = Provider<TodayService>(
  (Ref ref) => TodayService(
    clientFactory: ref.watch(apiClientFactoryProvider),
    cacheDb: ref.watch(cacheDbProvider),
  ),
);

final Provider<EventsService> eventsServiceProvider = Provider<EventsService>(
  (Ref ref) => EventsService(
    clientFactory: ref.watch(apiClientFactoryProvider),
    cacheDb: ref.watch(cacheDbProvider),
  ),
);

final Provider<NotesService> notesServiceProvider = Provider<NotesService>(
  (Ref ref) => NotesService(
    clientFactory: ref.watch(apiClientFactoryProvider),
    cacheDb: ref.watch(cacheDbProvider),
    writeQueueService: ref.watch(writeQueueServiceProvider),
  ),
);

final Provider<GroceryService> groceryServiceProvider =
    Provider<GroceryService>(
  (Ref ref) => GroceryService(
    clientFactory: ref.watch(apiClientFactoryProvider),
    cacheDb: ref.watch(cacheDbProvider),
    writeQueueService: ref.watch(writeQueueServiceProvider),
  ),
);

final Provider<MealPlanService> mealPlanServiceProvider =
    Provider<MealPlanService>(
  (Ref ref) => MealPlanService(
    clientFactory: ref.watch(apiClientFactoryProvider),
    cacheDb: ref.watch(cacheDbProvider),
  ),
);

final Provider<CalendarSetupService> calendarSetupServiceProvider =
    Provider<CalendarSetupService>(
  (Ref ref) =>
      CalendarSetupService(clientFactory: ref.watch(apiClientFactoryProvider)),
);

final Provider<MembersService> membersServiceProvider =
    Provider<MembersService>(
  (Ref ref) =>
      MembersService(clientFactory: ref.watch(apiClientFactoryProvider)),
);

class SessionState {
  const SessionState({required this.loaded, required this.session});

  const SessionState.loading()
      : loaded = false,
        session = null;

  const SessionState.none()
      : loaded = true,
        session = null;

  const SessionState.signedIn(this.session) : loaded = true;

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
    if (stored != null && stored.installationId == null) {
      // Device paired before the installationId contract existed. Backfill
      // it opportunistically so connection recovery can verify candidates
      // by identity instead of falling back to "exactly one host found".
      unawaited(_backfillInstallationId(stored));
    }
  }

  Future<void> _backfillInstallationId(Session session) async {
    final IdentityResult? result =
        await ref.read(identityServiceProvider).fetch(session.serverUrl);
    if (result != null) {
      await updateInstallationId(result.installationId);
    }
  }

  Future<void> adopt(Session session) async {
    await ref.read(sessionStoreProvider).write(session);
    state = SessionState.signedIn(session);
  }

  /// Persists a rediscovered `serverUrl` (and its verified `installationId`)
  /// after the wall's LAN IP changed. No-op if the session was cleared out
  /// from under a concurrent recovery attempt.
  Future<void> applyRecoveredConnection(RecoveredConnection recovered) async {
    final Session? current = state.session;
    if (current == null) {
      return;
    }
    final Session updated = current.copyWith(
      serverUrl: recovered.serverUrl,
      installationId: recovered.installationId,
    );
    await ref.read(sessionStoreProvider).write(updated);
    state = SessionState.signedIn(updated);
  }

  /// Backfills [Session.installationId] for a pairing that predates this
  /// field, without touching `serverUrl`.
  Future<void> updateInstallationId(String installationId) async {
    final Session? current = state.session;
    if (current == null || current.installationId == installationId) {
      return;
    }
    final Session updated = current.copyWith(installationId: installationId);
    await ref.read(sessionStoreProvider).write(updated);
    state = SessionState.signedIn(updated);
  }

  Future<void> clear() async {
    await ref.read(sessionStoreProvider).clear();
    // Wipe the read cache so stale data from a revoked device can't leak to
    // the next pairing on the same install.
    await ref.read(cacheDbProvider).clearAll();
    state = const SessionState.none();
  }
}

final NotifierProvider<SessionNotifier, SessionState> sessionProvider =
    NotifierProvider<SessionNotifier, SessionState>(SessionNotifier.new);
