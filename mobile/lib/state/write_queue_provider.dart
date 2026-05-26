import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'connectivity_provider.dart';
import 'session_provider.dart';

// Re-export so callers can import from a single location.
export 'session_provider.dart' show writeQueueServiceProvider;

/// Emits the pending queue count for the current session member.
///
/// Polls every 2 seconds while the provider is alive. Screens can use this
/// to show / hide the [QueueBadge] widget.
final StreamProvider<int> queueCountProvider = StreamProvider<int>(
  (Ref ref) async* {
    while (true) {
      final SessionState sessionState = ref.read(sessionProvider);
      final session = sessionState.session;
      if (session != null) {
        final int count =
            await ref.read(cacheDbProvider).queueCount(session.member.id);
        yield count;
      } else {
        yield 0;
      }
      await Future<void>.delayed(const Duration(seconds: 2));
    }
  },
);

/// Watches [connectivityProvider] and fires a replay pass whenever the device
/// transitions from offline to online.
///
/// Mount this provider once in [FamilyBoardApp] so the listener is alive for
/// the entire app lifetime.
final Provider<void> queueReplayCoordinatorProvider = Provider<void>(
  (Ref ref) {
    ref.listen<AsyncValue<bool>>(
      connectivityProvider,
      (AsyncValue<bool>? prev, AsyncValue<bool> next) {
        final bool wasOffline = prev?.value == false;
        final bool nowOnline = next.value == true;
        if (wasOffline && nowOnline) {
          final SessionState ss = ref.read(sessionProvider);
          final session = ss.session;
          if (session != null) {
            unawaited(ref.read(writeQueueServiceProvider).replay(session));
          }
        }
      },
    );
  },
);
