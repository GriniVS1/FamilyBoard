// Fixes 2026-07-27T04-40-06-foreground-poll-misses-midnight-range-rollover:
// `eventsProvider` is an autoDispose family keyed by `EventsRange` *value*
// equality. Before this file existed, both `HomeScreen.build()` and the
// poll/resume refresh in `SessionNotifier` independently called a plain
// `homeEventsRange()` function to compute "today through +8 days" — which
// is fine most of the time, but if the app stays foregrounded across local
// midnight without a rebuild in between, the widget keeps watching
// yesterday's range while the poll recomputes and invalidates *today's*
// range: a different (and likely nonexistent, since nothing has watched it
// yet) family member. The invalidation is a silent no-op and the home
// screen never rolls forward.
//
// Fix: a single `NotifierProvider<EventsRange>` that both sides read/watch,
// so there is exactly one current range value for the whole app — and it
// rolls itself forward at local midnight via an internal timer, independent
// of any lifecycle event. `HomeScreen` watches it directly (so the day
// change is itself a rebuild trigger), and `SessionNotifier`'s poll/resume
// paths read the same instance before invalidating, so they always target
// whatever range the widget tree is actually watching.

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'events_provider.dart';

/// Local midnight for [now].
DateTime _midnightOf(DateTime now) => DateTime(now.year, now.month, now.day);

/// Today (inclusive) through +8 days — covers the Heute card (today) and the
/// Demnächst card (the 7 days after today) from a single fetch.
EventsRange _rangeFor(DateTime now) {
  final DateTime today = _midnightOf(now);
  return EventsRange(from: today, to: today.add(const Duration(days: 8)));
}

/// Schedules a callback for the next local-midnight rollover, then
/// reschedules itself. [now] and [timerFactory] are injectable so the
/// scheduling math is unit-testable without waiting on real wall-clock time.
class MidnightRolloverScheduler {
  MidnightRolloverScheduler({
    required this.onRollover,
    DateTime Function()? now,
    Timer Function(Duration duration, void Function() callback)? timerFactory,
  }) : _now = now ?? DateTime.now,
       _timerFactory = timerFactory ?? Timer.new;

  final void Function() onRollover;
  final DateTime Function() _now;
  final Timer Function(Duration duration, void Function() callback)
  _timerFactory;

  Timer? _timer;

  bool get isScheduled => _timer != null;

  /// Delay until 1s past the next local midnight. The 1s slack means a
  /// timer that fires a hair early (device clock/timer jitter) still lands
  /// on the new day when it recomputes, rather than firing again ~0ms later
  /// for the actual boundary.
  Duration delayUntilNextRollover() {
    final DateTime now = _now();
    final DateTime nextMidnight = DateTime(now.year, now.month, now.day + 1);
    return nextMidnight.difference(now) + const Duration(seconds: 1);
  }

  /// No-op if already scheduled.
  void start() {
    if (_timer != null) {
      return;
    }
    _timer = _timerFactory(delayUntilNextRollover(), _fire);
  }

  void _fire() {
    _timer = null;
    onRollover();
    start();
  }

  /// No-op if already stopped.
  void stop() {
    _timer?.cancel();
    _timer = null;
  }
}

/// Keeps the Heute/Demnächst window in sync with the wall clock. Plain
/// `NotifierProvider` (not autoDispose, not a family) — there is exactly one
/// instance for the whole app, so `ref.watch`/`ref.read` from anywhere
/// always see the same current range.
///
/// [now]/[timerFactory] are only ever overridden in tests (via
/// `currentHomeRangeProvider.overrideWith`) — production code always uses
/// the `HomeRangeNotifier.new` default, which is real `DateTime.now`/`Timer`.
class HomeRangeNotifier extends Notifier<EventsRange> {
  HomeRangeNotifier({DateTime Function()? now, this._timerFactory})
    : _now = now ?? DateTime.now;

  final DateTime Function() _now;
  final Timer Function(Duration duration, void Function() callback)?
  _timerFactory;

  late final MidnightRolloverScheduler _scheduler = MidnightRolloverScheduler(
    onRollover: () => state = _rangeFor(_now()),
    now: _now,
    timerFactory: _timerFactory,
  );

  @override
  EventsRange build() {
    ref.onDispose(_scheduler.stop);
    _scheduler.start();
    return _rangeFor(_now());
  }
}

/// The current Heute/Demnächst `EventsRange`. Read this — never recompute a
/// range independently from `DateTime.now()` — anywhere that needs to
/// invalidate or watch the home screen's events window, so it always
/// matches exactly what `HomeScreen` is watching.
final NotifierProvider<HomeRangeNotifier, EventsRange>
currentHomeRangeProvider = NotifierProvider<HomeRangeNotifier, EventsRange>(
  HomeRangeNotifier.new,
);
