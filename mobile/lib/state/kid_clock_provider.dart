import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../kids/tap_guards.dart';
import '../kids/time_of_day.dart';

/// Source of "now" for every kid-facing widget (day phase, toast windows, tap
/// guards). Tests override it with a fake clock.
final Provider<Clock> kidClockProvider = Provider<Clock>(
  (Ref ref) => DateTime.now,
);

/// One [TapGuard] for the whole app: Heute and Aufgaben share the clock and
/// the bookkeeping, every call carries its own list key.
final Provider<TapGuard> tapGuardProvider = Provider<TapGuard>(
  (Ref ref) => TapGuard(clock: ref.watch(kidClockProvider)),
);
