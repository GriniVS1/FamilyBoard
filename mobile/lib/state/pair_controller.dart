import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/session.dart';
import '../services/pair_service.dart';
import 'pairing_adoption.dart';
import 'session_provider.dart';

class PairFormState {
  const PairFormState({required this.submitting, required this.error});

  const PairFormState.idle() : submitting = false, error = null;

  const PairFormState.submitting() : submitting = true, error = null;

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
    String? altUrl,
    String? remoteUrl,
  }) async {
    state = const PairFormState.submitting();
    final PairService pairService = ref.read(pairServiceProvider);
    try {
      final Session session = await pairService.pair(
        PairRequest(
          serverUrl: serverUrl,
          code: code,
          deviceName: deviceName,
          altUrl: altUrl,
          remoteUrl: remoteUrl,
        ),
      );
      await adoptPairedSession(ref, session);
      state = const PairFormState.idle();
      return true;
    } on PairException catch (err) {
      state = PairFormState.failed(err.kind);
      return false;
    }
  }

  void reset() {
    state = const PairFormState.idle();
  }
}

final NotifierProvider<PairController, PairFormState> pairControllerProvider =
    NotifierProvider<PairController, PairFormState>(PairController.new);
