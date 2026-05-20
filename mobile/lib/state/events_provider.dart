import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/events_service.dart';
import 'session_provider.dart';

/// Immutable range descriptor used as the family parameter for [eventsProvider].
class EventsRange {
  const EventsRange({required this.from, required this.to});

  final DateTime from;
  final DateTime to;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is EventsRange &&
          runtimeType == other.runtimeType &&
          from == other.from &&
          to == other.to;

  @override
  int get hashCode => Object.hash(from, to);
}

/// Fetches events for the given [EventsRange].
///
/// Watches the current session so it rebuilds when the session changes.
/// Callers can trigger a manual refresh via `ref.invalidate(eventsProvider(range))`.
///
/// Returns an [EventsResult] whose [EventsResult.staleAt] is non-null when the
/// data was served from the disk cache (offline scenario).
final AutoDisposeFutureProviderFamily<EventsResult, EventsRange>
    eventsProvider = FutureProvider.autoDispose
        .family<EventsResult, EventsRange>((Ref ref, EventsRange range) async {
  final SessionState sessionState = ref.watch(sessionProvider);
  final session = sessionState.session;
  if (session == null) {
    throw const EventsFetchException('No active session');
  }
  return ref.watch(eventsServiceProvider).fetchEvents(
        session: session,
        from: range.from,
        to: range.to,
      );
});
