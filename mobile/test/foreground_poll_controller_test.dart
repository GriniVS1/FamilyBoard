// Unit tests for ForegroundPollController's start/stop lifecycle. A fake
// timer factory is injected so these exercise the idempotency contract
// without waiting on real wall-clock time.

import 'dart:async';

import 'package:familyboard_mobile/state/foreground_poll_controller.dart';
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
  group('ForegroundPollController', () {
    late List<_FakeTimer> createdTimers;
    late int tickCount;

    ForegroundPollController buildController() {
      createdTimers = <_FakeTimer>[];
      tickCount = 0;
      return ForegroundPollController(
        interval: const Duration(seconds: 30),
        onTick: () => tickCount++,
        timerFactory: (Duration interval, void Function() callback) {
          final _FakeTimer timer = _FakeTimer(callback);
          createdTimers.add(timer);
          return timer;
        },
      );
    }

    test('start() creates a timer and reports isRunning', () {
      final ForegroundPollController controller = buildController();

      expect(controller.isRunning, isFalse);
      controller.start();

      expect(controller.isRunning, isTrue);
      expect(createdTimers, hasLength(1));
      expect(createdTimers.single.cancelled, isFalse);
    });

    test('start() while already running is a no-op (no second timer)', () {
      final ForegroundPollController controller = buildController();

      controller.start();
      controller.start();
      controller.start();

      expect(createdTimers, hasLength(1));
    });

    test('stop() cancels the timer and clears isRunning', () {
      final ForegroundPollController controller = buildController();

      controller.start();
      controller.stop();

      expect(controller.isRunning, isFalse);
      expect(createdTimers.single.cancelled, isTrue);
    });

    test('stop() while already stopped is a safe no-op', () {
      final ForegroundPollController controller = buildController();

      expect(controller.stop, returnsNormally);
      expect(controller.isRunning, isFalse);
    });

    test('start() after stop() creates a fresh timer', () {
      final ForegroundPollController controller = buildController();

      controller.start();
      controller.stop();
      controller.start();

      expect(createdTimers, hasLength(2));
      expect(createdTimers.first.cancelled, isTrue);
      expect(createdTimers.last.cancelled, isFalse);
      expect(controller.isRunning, isTrue);
    });

    test('invoking the fake timer callback runs onTick', () {
      final ForegroundPollController controller = buildController();

      controller.start();
      createdTimers.single.callback();
      createdTimers.single.callback();

      expect(tickCount, equals(2));
    });
  });
}
