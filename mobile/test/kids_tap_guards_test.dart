// Port of the rules in src/lib/tap-guards.ts and src/lib/undo-guard.ts
// (R5.3-R5.5) with an injected clock.

import 'package:familyboard_mobile/kids/layout_hold.dart';
import 'package:familyboard_mobile/kids/tap_guards.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeClock {
  DateTime now = DateTime.utc(2026, 10, 2, 14, 30);

  DateTime call() => now;

  void advance(int ms) => now = now.add(Duration(milliseconds: ms));
}

void main() {
  test('ported constants match the wall', () {
    expect(kColumnTapLockMs, 600);
    expect(kLayoutTapGuardMs, 600);
    expect(kScrollTapGuardMs, 300);
    expect(kLayoutQuietMs, 3000);
    expect(kUndoArmMs, 600);
    expect(kFreshUndoMs, 8000);
    expect(kRevealedUndoMs, 5000);
  });

  group('isUndoArmed (UNDO_ARM_MS)', () {
    final DateTime shown = DateTime.utc(2026, 10, 2, 14, 30);

    test('inert for the first 600 ms', () {
      expect(isUndoArmed(shown, shown), isFalse);
      expect(
        isUndoArmed(shown, shown.add(const Duration(milliseconds: 599))),
        isFalse,
      );
    });

    test('armed from 600 ms on', () {
      expect(
        isUndoArmed(shown, shown.add(const Duration(milliseconds: 600))),
        isTrue,
      );
      expect(isUndoArmed(shown, shown.add(const Duration(seconds: 5))), isTrue);
    });
  });

  group('TapGuard', () {
    late FakeClock clock;
    late TapGuard guard;

    setUp(() {
      clock = FakeClock();
      guard = TapGuard(clock: clock.call);
    });

    test('nothing recorded: every tap is allowed', () {
      expect(guard.check('tasks', 'a'), TapVerdict.allowed);
    });

    test(
      'after a tick, another card of the same list is locked for 600 ms',
      () {
        guard.recordCompletion('tasks', 'a');
        clock.advance(300);
        expect(guard.check('tasks', 'b'), TapVerdict.columnLocked);
        clock.advance(299);
        expect(guard.check('tasks', 'b'), TapVerdict.columnLocked);
        clock.advance(1);
        expect(guard.check('tasks', 'b'), TapVerdict.allowed);
      },
    );

    test('the ticked card itself and other lists are not locked', () {
      guard.recordCompletion('tasks', 'a');
      clock.advance(100);
      expect(guard.check('tasks', 'a'), TapVerdict.allowed);
      expect(guard.check('home', 'b'), TapVerdict.allowed);
    });

    test('cards that moved: taps in that list are dropped for 600 ms', () {
      guard.recordLayoutShift('tasks');
      clock.advance(599);
      expect(guard.check('tasks', 'a'), TapVerdict.layoutShifted);
      expect(guard.check('home', 'a'), TapVerdict.allowed);
      clock.advance(1);
      expect(guard.check('tasks', 'a'), TapVerdict.allowed);
    });

    test('a scroll makes taps in its list unreliable for 300 ms', () {
      guard.recordScroll('tasks');
      clock.advance(299);
      expect(guard.check('tasks', 'a'), TapVerdict.scrolling);
      expect(guard.check('home', 'a'), TapVerdict.allowed);
      clock.advance(1);
      expect(guard.check('tasks', 'a'), TapVerdict.allowed);
    });

    test('a page scroll invalidates every list', () {
      guard.recordScroll(kPageScrollKey);
      clock.advance(100);
      expect(guard.check('tasks', 'a'), TapVerdict.scrolling);
      expect(guard.check('home', 'a'), TapVerdict.scrolling);
    });

    test('hold: a touch within 3 s or an open window keeps the layout', () {
      expect(guard.shouldHoldLayout(windowOpen: false), isFalse);
      guard.touch();
      clock.advance(2999);
      expect(guard.shouldHoldLayout(windowOpen: false), isTrue);
      clock.advance(1);
      expect(guard.shouldHoldLayout(windowOpen: false), isFalse);
      expect(guard.shouldHoldLayout(windowOpen: true), isTrue);
    });
  });

  group(
    'HeldLayout (resort only after >= 3 s untouched and window closed)',
    () {
      late FakeClock clock;
      late TapGuard guard;
      late int shifts;
      late HeldLayout<List<String>> held;

      setUp(() {
        clock = FakeClock();
        guard = TapGuard(clock: clock.call);
        shifts = 0;
        held = HeldLayout<List<String>>(
          guard: guard,
          initial: <String>['a', 'b', 'c'],
          signature: 'abc',
          onShift: () => shifts += 1,
        );
      });

      test('without interaction a change applies at once', () {
        held.update(<String>['b', 'c', 'a'], 'bca', windowOpen: false);
        expect(held.value, <String>['b', 'c', 'a']);
        expect(held.held, isFalse);
        expect(shifts, 1);
      });

      test('under a finger the old layout stays', () {
        guard.touch();
        held.update(<String>['b', 'c', 'a'], 'bca', windowOpen: false);
        expect(held.value, <String>['a', 'b', 'c']);
        expect(held.held, isTrue);
        expect(shifts, 0);
      });

      test('released after 3 s of quiet when no undo window is open', () {
        guard.touch();
        held.update(<String>['b', 'c', 'a'], 'bca', windowOpen: false);
        clock.advance(2999);
        expect(held.tick(windowOpen: false), isFalse);
        expect(held.value, <String>['a', 'b', 'c']);
        clock.advance(1);
        expect(held.tick(windowOpen: false), isTrue);
        expect(held.value, <String>['b', 'c', 'a']);
        expect(shifts, 1);
      });

      test('an open undo window keeps holding past 3 s', () {
        guard.touch();
        held.update(<String>['b', 'c', 'a'], 'bca', windowOpen: true);
        clock.advance(7000);
        expect(held.tick(windowOpen: true), isFalse);
        expect(held.value, <String>['a', 'b', 'c']);
        clock.advance(1000);
        expect(held.tick(windowOpen: false), isTrue);
        expect(held.value, <String>['b', 'c', 'a']);
      });

      test('every new touch restarts the 3 s wait', () {
        guard.touch();
        held.update(<String>['b', 'c', 'a'], 'bca', windowOpen: false);
        clock.advance(2500);
        guard.touch();
        clock.advance(2500);
        expect(held.tick(windowOpen: false), isFalse);
        clock.advance(500);
        expect(held.tick(windowOpen: false), isTrue);
      });

      test('the same signature never moves anything', () {
        guard.touch();
        held.update(<String>['x'], 'abc', windowOpen: false);
        expect(held.value, <String>['a', 'b', 'c']);
        expect(held.held, isFalse);
        expect(shifts, 0);
      });
    },
  );
}
