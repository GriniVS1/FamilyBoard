import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../kids/undo_toast_controller.dart';
import 'kid_clock_provider.dart';

/// The open undo toasts. Lives for the whole app so a toast survives tab
/// switches (the host sits in the tab shell, see `AppShell`).
final Provider<UndoToastController> undoToastProvider =
    Provider<UndoToastController>((Ref ref) {
      final UndoToastController controller = UndoToastController(
        clock: ref.watch(kidClockProvider),
      );
      ref.onDispose(controller.dispose);
      return controller;
    });
