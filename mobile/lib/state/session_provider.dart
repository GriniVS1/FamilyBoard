import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../db/cache_db.dart';
import '../models/session.dart';
import '../services/api_client.dart';
import '../services/calendar_setup_service.dart';
import '../services/chores_service.dart';
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
import '../services/photos_service.dart';
import '../services/secure_storage.dart';
import '../services/today_service.dart';
import '../services/todos_service.dart';
import '../services/write_queue_service.dart';
import 'connectivity_provider.dart';
import 'data_refresh.dart';
import 'foreground_poll_controller.dart';
import 'home_range_provider.dart';

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
          final RecoveredConnection? recovered = await ref
              .read(connectionRecoveryServiceProvider)
              .recover(session);
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

final Provider<CacheDb> cacheDbProvider = Provider<CacheDb>(
  (_) => CacheDb.instance,
);

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
        clientFactory: ref.watch(apiClientFactoryProvider),
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

/// Read-only — writes for todos go through [mutationsServiceProvider].
final Provider<TodosService> todosServiceProvider = Provider<TodosService>(
  (Ref ref) => TodosService(
    clientFactory: ref.watch(apiClientFactoryProvider),
    cacheDb: ref.watch(cacheDbProvider),
  ),
);

/// Read-only — writes for chores (complete/undo/create) go through
/// [mutationsServiceProvider].
final Provider<ChoresService> choresServiceProvider = Provider<ChoresService>(
  (Ref ref) => ChoresService(
    clientFactory: ref.watch(apiClientFactoryProvider),
    cacheDb: ref.watch(cacheDbProvider),
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
      (Ref ref) => CalendarSetupService(
        clientFactory: ref.watch(apiClientFactoryProvider),
      ),
    );

final Provider<MembersService> membersServiceProvider =
    Provider<MembersService>(
      (Ref ref) =>
          MembersService(clientFactory: ref.watch(apiClientFactoryProvider)),
    );

final Provider<PhotosService> photosServiceProvider = Provider<PhotosService>(
  (Ref ref) =>
      PhotosService(clientFactory: ref.watch(apiClientFactoryProvider)),
);

class SessionState {
  const SessionState({required this.loaded, required this.session});

  const SessionState.loading() : loaded = false, session = null;

  const SessionState.none() : loaded = true, session = null;

  const SessionState.signedIn(this.session) : loaded = true;

  final bool loaded;
  final Session? session;

  bool get hasSession => session != null;
}

class SessionNotifier extends Notifier<SessionState>
    with WidgetsBindingObserver {
  /// Whether the app is currently in the foreground — tracked ourselves
  /// (rather than reading `WidgetsBinding.instance.lifecycleState`) so
  /// [_load]/[adopt] can gate the initial poll start the same way
  /// [didChangeAppLifecycleState] does. Defaults to true: Flutter doesn't
  /// fire a `resumed` lifecycle event on cold start, the app simply begins
  /// in the foreground.
  bool _foreground = true;

  /// Refreshes [visibleHomeProviders] every 30s while the app is foreground
  /// and signed in. Started on resume/app start, stopped on
  /// pause/inactive/detached/hidden and on sign-out — see
  /// [didChangeAppLifecycleState] and [clear].
  late final ForegroundPollController _pollController =
      ForegroundPollController(
        interval: const Duration(seconds: 30),
        onTick: _pollTick,
      );

  @override
  SessionState build() {
    WidgetsBinding.instance.addObserver(this);
    ref.onDispose(() {
      WidgetsBinding.instance.removeObserver(this);
      _pollController.stop();
    });
    // Return-to-LAN trigger #2: connectivity flips to Wi-Fi while we're
    // pinned to the relay. Trigger #1 (app resume) is the
    // didChangeAppLifecycleState override below.
    ref.listen<AsyncValue<bool>>(wifiConnectivityProvider, (
      AsyncValue<bool>? previous,
      AsyncValue<bool> next,
    ) {
      final bool cameOnWifi = next.value == true && previous?.value != true;
      if (cameOnWifi) {
        unawaited(_maybeReturnToLan());
      }
    });
    Future<void>.microtask(_load);
    return const SessionState.loading();
  }

  void _pollTick() {
    if (!state.hasSession) {
      return;
    }
    // Read (not recompute) the current range — must target whatever
    // instance HomeScreen is actually watching, see home_range_provider.dart.
    invalidateVisibleHomeProviders(
      range: ref.read(currentHomeRangeProvider),
      invalidate: ref.invalidate,
    );
  }

  /// Starts the foreground poll if a session is signed in and the app is
  /// currently foreground. Safe to call from multiple places — [start] is a
  /// no-op when already running.
  void _maybeStartPoll() {
    if (state.hasSession && _foreground) {
      _pollController.start();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        _foreground = true;
        unawaited(_onResumed());
        break;
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
      case AppLifecycleState.detached:
      case AppLifecycleState.hidden:
        _foreground = false;
        _pollController.stop();
        break;
    }
  }

  /// Order matters: the return-to-LAN probe may rewrite the session's base
  /// URL, so the refresh below must run after it completes — otherwise a
  /// resume right after a relay→LAN flip would refetch against the stale
  /// (about to be replaced) URL.
  Future<void> _onResumed() async {
    await _maybeReturnToLan();
    if (state.hasSession) {
      invalidateVisibleHomeProviders(
        range: ref.read(currentHomeRangeProvider),
        invalidate: ref.invalidate,
      );
      _pollController.start();
    }
  }

  Future<void> _load() async {
    final Session? stored = await ref.read(sessionStoreProvider).read();
    state = stored == null
        ? const SessionState.none()
        : SessionState.signedIn(stored);
    _maybeStartPoll();
    if (stored != null &&
        (stored.installationId == null || stored.remoteUrl == null)) {
      // Device paired before the installationId/remoteUrl contract existed
      // (or before the wall had a relay configured). Backfill opportunistically
      // over the LAN so connection recovery can verify candidates by identity
      // and fall back to the relay when off-LAN.
      unawaited(_backfillFromIdentity(stored));
    }
  }

  Future<void> _backfillFromIdentity(Session session) async {
    final IdentityResult? result = await ref
        .read(identityServiceProvider)
        .fetch(session.serverUrl);
    if (result != null) {
      await applyIdentity(result);
    }
  }

  Future<void> adopt(Session session) async {
    await ref.read(sessionStoreProvider).write(session);
    state = SessionState.signedIn(session);
    _maybeStartPoll();
  }

  /// Persists a rediscovered base URL (and its verified `installationId`)
  /// after the wall became unreachable at [Session.serverUrl]. No-op if the
  /// session was cleared out from under a concurrent recovery attempt.
  ///
  /// A LAN candidate (`recovered.isRemote == false`) replaces `serverUrl`
  /// itself and clears `activeUrl` back to null. A relay candidate
  /// (`isRemote == true`) only sets `activeUrl` — `serverUrl` is left alone
  /// so the app keeps trying the real LAN address (via [probeLan]) and can
  /// flip back to it later.
  Future<void> applyRecoveredConnection(RecoveredConnection recovered) async {
    final Session? current = state.session;
    if (current == null) {
      return;
    }
    final Session updated = recovered.isRemote
        ? current.copyWith(
            activeUrl: recovered.serverUrl,
            installationId: recovered.installationId,
          )
        : current.copyWith(
            serverUrl: recovered.serverUrl,
            installationId: recovered.installationId,
            activeUrl: null,
          );
    await ref.read(sessionStoreProvider).write(updated);
    state = SessionState.signedIn(updated);
  }

  /// Persists `installationId`/`remoteUrl` fetched from `GET
  /// /api/mobile/identity`, used both right after pairing and to backfill a
  /// pre-relay pairing. `remoteUrl` is only ever overwritten when [result]
  /// actually carries one (a fetch made over the relay redacts it).
  Future<void> applyIdentity(IdentityResult result) async {
    final Session? current = state.session;
    if (current == null) {
      return;
    }
    final bool idChanged = current.installationId != result.installationId;
    final bool remoteChanged =
        result.remoteUrl != null && current.remoteUrl != result.remoteUrl;
    if (!idChanged && !remoteChanged) {
      return;
    }
    final Session updated = current.copyWith(
      installationId: result.installationId,
      remoteUrl: result.remoteUrl,
    );
    await ref.read(sessionStoreProvider).write(updated);
    state = SessionState.signedIn(updated);
  }

  /// Called on app resume and on a connectivity flip to Wi-Fi. If the
  /// session is currently pinned to the relay (`activeUrl == remoteUrl`),
  /// probes the LAN address (then `altUrl`) and flips back silently on a
  /// verified match — no user action involved.
  Future<void> _maybeReturnToLan() async {
    final Session? current = state.session;
    if (current == null || current.activeUrl == null) {
      return;
    }
    if (current.activeUrl != current.remoteUrl) {
      // activeUrl is set but isn't the relay — nothing to flip back from.
      return;
    }
    final RecoveredConnection? lan = await ref
        .read(connectionRecoveryServiceProvider)
        .probeLan(current);
    if (lan == null) {
      return;
    }
    await applyRecoveredConnection(lan);
  }

  Future<void> clear() async {
    await ref.read(sessionStoreProvider).clear();
    // Wipe the read cache so stale data from a revoked device can't leak to
    // the next pairing on the same install.
    await ref.read(cacheDbProvider).clearAll();
    state = const SessionState.none();
    _pollController.stop();
  }
}

final NotifierProvider<SessionNotifier, SessionState> sessionProvider =
    NotifierProvider<SessionNotifier, SessionState>(SessionNotifier.new);
