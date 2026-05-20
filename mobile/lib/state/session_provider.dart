import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../db/cache_db.dart';
import '../models/session.dart';
import '../services/api_client.dart';
import '../services/events_service.dart';
import '../services/fcm_service.dart';
import '../services/grocery_service.dart';
import '../services/heartbeat_service.dart';
import '../services/meal_plan_service.dart';
import '../services/mutations_service.dart';
import '../services/notes_service.dart';
import '../services/pair_service.dart';
import '../services/secure_storage.dart';
import '../services/today_service.dart';

final Provider<ApiClientFactory> apiClientFactoryProvider =
    Provider<ApiClientFactory>((Ref ref) => const ApiClientFactory());

final Provider<SecureSessionStore> sessionStoreProvider =
    Provider<SecureSessionStore>((Ref ref) => SecureSessionStore());

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

final Provider<MutationsService> mutationsServiceProvider =
    Provider<MutationsService>(
  (Ref ref) => MutationsService(
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
  ),
);

final Provider<GroceryService> groceryServiceProvider =
    Provider<GroceryService>(
  (Ref ref) => GroceryService(
    clientFactory: ref.watch(apiClientFactoryProvider),
    cacheDb: ref.watch(cacheDbProvider),
  ),
);

final Provider<MealPlanService> mealPlanServiceProvider =
    Provider<MealPlanService>(
  (Ref ref) => MealPlanService(
    clientFactory: ref.watch(apiClientFactoryProvider),
    cacheDb: ref.watch(cacheDbProvider),
  ),
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
  }

  Future<void> adopt(Session session) async {
    await ref.read(sessionStoreProvider).write(session);
    state = SessionState.signedIn(session);
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
