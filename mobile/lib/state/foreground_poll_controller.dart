import 'dart:async';

import 'package:flutter/widgets.dart' show AppLifecycleState;

/// Whether the foreground poll may keep running in [state].
///
/// `inactive` deliberately counts as alive. On the iPhone Duo (iOS 27) Split
/// View parks every visible-but-unfocused app in `inactive`, and such an app
/// is on screen and must keep refreshing. On classic iPhones `inactive` is a
/// transient state (app switcher, permission dialogs, Control Centre) that is
/// harmless to poll through. Only `paused`, `hidden` and `detached` mean the
/// app is no longer visible.
bool lifecycleKeepsPollAlive(AppLifecycleState state) {
  switch (state) {
    case AppLifecycleState.resumed:
    case AppLifecycleState.inactive:
      return true;
    case AppLifecycleState.paused:
    case AppLifecycleState.hidden:
    case AppLifecycleState.detached:
      return false;
  }
}

/// Drives the 30s foreground data-refresh poll. A thin wrapper around
/// `Timer.periodic` with idempotent start/stop semantics, so
/// `SessionNotifier` can call `start()`/`stop()` freely from several
/// lifecycle triggers (resume, pause, sign-in, sign-out) without worrying
/// about spawning duplicate timers or double-cancelling.
///
/// [timerFactory] is injectable so the start/stop transition logic can be
/// unit-tested without waiting on real wall-clock time.
class ForegroundPollController {
  ForegroundPollController({
    required this.interval,
    required this.onTick,
    Timer Function(Duration interval, void Function() callback)? timerFactory,
  }) : _timerFactory =
           timerFactory ??
           ((Duration d, void Function() cb) =>
               Timer.periodic(d, (Timer _) => cb()));

  final Duration interval;
  final void Function() onTick;
  final Timer Function(Duration interval, void Function() callback)
  _timerFactory;

  Timer? _timer;

  bool get isRunning => _timer != null;

  /// No-op if already running — resume can fire alongside a connectivity
  /// flip without spawning a second timer.
  void start() {
    if (_timer != null) {
      return;
    }
    _timer = _timerFactory(interval, onTick);
  }

  /// No-op if already stopped. Always safe to call, including from
  /// `dispose`/session-clear paths.
  void stop() {
    _timer?.cancel();
    _timer = null;
  }
}
