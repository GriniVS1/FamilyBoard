// Regression coverage for
// 2026-07-27T04-40-06-foreground-poll-misses-midnight-range-rollover:
// `MidnightRolloverScheduler`'s pure scheduling math, plus an integrated
// test proving that `currentHomeRangeProvider`'s watched state and its read
// state stay identical across a simulated midnight rollover — i.e. the poll
// path (`ref.read`) and the widget path (`ref.watch`) can never disagree on
// which `EventsRange` is current.

import 'dart:async';

import 'package:familyboard_mobile/state/events_provider.dart';
import 'package:familyboard_mobile/state/home_range_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

class _FakeTimer implements Timer {
  _FakeTimer(this.callback);

  final void Function() callback;
  bool cancelled = false;

  @override
  void cancel() => cancelled = true;

  @override
  bool get isActive => !cancelled;

  @override
  int get tick => 0;
}

void main() {
  group('MidnightRolloverScheduler', () {
    test('delayUntilNextRollover targets 1s past local midnight', () {
      final DateTime now = DateTime(2026, 7, 27, 23, 59, 0);
      final MidnightRolloverScheduler scheduler = MidnightRolloverScheduler(
        onRollover: () {},
        now: () => now,
      );

      // 1 minute to midnight + 1s slack.
      expect(
        scheduler.delayUntilNextRollover(),
        equals(const Duration(minutes: 1, seconds: 1)),
      );
    });

    test('start() schedules exactly once; re-start() is a no-op', () {
      final DateTime now = DateTime(2026, 7, 27, 12);
      final List<_FakeTimer> created = <_FakeTimer>[];
      final MidnightRolloverScheduler scheduler = MidnightRolloverScheduler(
        onRollover: () {},
        now: () => now,
        timerFactory: (Duration d, void Function() cb) {
          final _FakeTimer timer = _FakeTimer(cb);
          created.add(timer);
          return timer;
        },
      );

      scheduler.start();
      scheduler.start();

      expect(created, hasLength(1));
      expect(scheduler.isScheduled, isTrue);
    });

    test('firing the timer calls onRollover and reschedules', () {
      final DateTime now = DateTime(2026, 7, 27, 12);
      final List<_FakeTimer> created = <_FakeTimer>[];
      int rolloverCount = 0;
      final MidnightRolloverScheduler scheduler = MidnightRolloverScheduler(
        onRollover: () => rolloverCount++,
        now: () => now,
        timerFactory: (Duration d, void Function() cb) {
          final _FakeTimer timer = _FakeTimer(cb);
          created.add(timer);
          return timer;
        },
      );

      scheduler.start();
      created.single.callback();

      expect(rolloverCount, equals(1));
      expect(created, hasLength(2), reason: 'reschedules after firing');
      expect(scheduler.isScheduled, isTrue);
    });

    test('stop() cancels the pending timer', () {
      final DateTime now = DateTime(2026, 7, 27, 12);
      final List<_FakeTimer> created = <_FakeTimer>[];
      final MidnightRolloverScheduler scheduler = MidnightRolloverScheduler(
        onRollover: () {},
        now: () => now,
        timerFactory: (Duration d, void Function() cb) {
          final _FakeTimer timer = _FakeTimer(cb);
          created.add(timer);
          return timer;
        },
      );

      scheduler.start();
      scheduler.stop();

      expect(created.single.cancelled, isTrue);
      expect(scheduler.isScheduled, isFalse);
    });
  });

  group('currentHomeRangeProvider midnight rollover', () {
    test('watch and read agree before and after a simulated midnight '
        'rollover — the exact scenario the poll/resume paths depend on', () {
      DateTime now = DateTime(2026, 7, 27, 23, 59);
      void Function()? pendingRollover;

      final ProviderContainer container = ProviderContainer(
        overrides: <Override>[
          currentHomeRangeProvider.overrideWith(
            () => HomeRangeNotifier(
              now: () => now,
              timerFactory: (Duration d, void Function() cb) {
                pendingRollover = cb;
                return _FakeTimer(cb);
              },
            ),
          ),
        ],
      );
      addTearDown(container.dispose);

      // Establish a listener the same way HomeScreen's `ref.watch` would —
      // otherwise the provider's state changes wouldn't propagate to
      // anything (there'd be nothing observing them).
      final List<EventsRange> seen = <EventsRange>[];
      container.listen<EventsRange>(
        currentHomeRangeProvider,
        (EventsRange? previous, EventsRange next) => seen.add(next),
        fireImmediately: true,
      );

      final EventsRange initialWatched = container.read(
        currentHomeRangeProvider,
      );
      expect(initialWatched.from, equals(DateTime(2026, 7, 27)));

      // Simulate the poll/resume path: it must read the *same* range the
      // widget tree is watching, not recompute one independently.
      final EventsRange initialRead = container.read(currentHomeRangeProvider);
      expect(initialRead, equals(initialWatched));

      // Cross local midnight while the app stays foregrounded — nobody
      // paused/resumed, just the scheduler's own timer firing.
      now = DateTime(2026, 7, 28, 0, 0, 5);
      expect(pendingRollover, isNotNull);
      pendingRollover!();

      final EventsRange rolledWatched = container.read(
        currentHomeRangeProvider,
      );
      final EventsRange rolledRead = container.read(currentHomeRangeProvider);

      expect(rolledWatched.from, equals(DateTime(2026, 7, 28)));
      expect(rolledRead, equals(rolledWatched));
      expect(seen.last, equals(rolledWatched));
    });
  });
}
