import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/session.dart';
import '../services/fcm_service.dart';
import '../services/pair_service.dart';
import 'session_provider.dart';

class PairFormState {
  const PairFormState({
    required this.submitting,
    required this.error,
  });

  const PairFormState.idle()
      : submitting = false,
        error = null;

  const PairFormState.submitting()
      : submitting = true,
        error = null;

  const PairFormState.failed(PairErrorKind kind)
      : submitting = false,
        error = kind;

  final bool submitting;
  final PairErrorKind? error;
}

class PairController extends Notifier<PairFormState> {
  @override
  PairFormState build() => const PairFormState.idle();

  Future<bool> submit({
    required String serverUrl,
    required String code,
    required String deviceName,
  }) async {
    state = const PairFormState.submitting();
    final PairService pairService = ref.read(pairServiceProvider);
    try {
      final Session session = await pairService.pair(
        PairRequest(
          serverUrl: serverUrl,
          code: code,
          deviceName: deviceName,
        ),
      );
      await ref.read(sessionProvider.notifier).adopt(session);

      // FCM enrollment: intentionally non-blocking so the pair flow never
      // freezes waiting for a slow system permission dialog.
      unawaited(_enrollFcm(session));

      state = const PairFormState.idle();
      return true;
    } on PairException catch (err) {
      state = PairFormState.failed(err.kind);
      return false;
    }
  }

  /// Requests notification permission, fetches the FCM token, and registers
  /// it with the wall. Runs fully async — the pair flow does not await this,
  /// so a slow permission dialog never blocks the UI transition to Home.
  Future<void> _enrollFcm(Session session) async {
    final FcmService fcm = ref.read(fcmServiceProvider);
    final bool granted = await fcm.requestPermission();
    if (!granted) {
      return;
    }
    final String? token = await fcm.getToken();
    if (token != null) {
      await fcm.registerWithWall(session, token);
    }
  }

  void reset() {
    state = const PairFormState.idle();
  }
}

final NotifierProvider<PairController, PairFormState> pairControllerProvider =
    NotifierProvider<PairController, PairFormState>(PairController.new);
