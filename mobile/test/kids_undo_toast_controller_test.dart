import 'package:familyboard_mobile/kids/undo_toast_controller.dart';
import 'package:flutter_test/flutter_test.dart';

import 'kids_tap_guards_test.dart' show FakeClock;

UndoToastEntry _show(
  UndoToastController c,
  String choreId, {
  UndoToastKind kind = UndoToastKind.fresh,
}) {
  return c.show(
    kind: kind,
    choreId: choreId,
    title: choreId,
    icon: null,
    points: 2,
    memberName: 'Mia',
    memberColor: 'lilac',
    memberEmoji: '🦄',
    onUndo: () {},
  );
}

void main() {
  late FakeClock clock;
  late UndoToastController toasts;

  setUp(() {
    clock = FakeClock();
    toasts = UndoToastController(clock: clock.call);
  });

  tearDown(() => toasts.dispose());

  test('a fresh tick opens an 8 s window', () {
    final UndoToastEntry e = _show(toasts, 'a');
    expect(e.durationMs, 8000);
    clock.advance(7999);
    toasts.sweep();
    expect(toasts.entries, hasLength(1));
    clock.advance(1);
    toasts.sweep();
    expect(toasts.entries, isEmpty);
  });

  test('a tap on an older done card opens a 5 s window', () {
    final UndoToastEntry e = _show(toasts, 'a', kind: UndoToastKind.revealed);
    expect(e.durationMs, 5000);
    clock.advance(4999);
    toasts.sweep();
    expect(toasts.entries, hasLength(1));
    clock.advance(1);
    toasts.sweep();
    expect(toasts.entries, isEmpty);
  });

  test('an error toast stays 15 s and holds no undo window', () {
    final UndoToastEntry e = _show(toasts, 'a', kind: UndoToastKind.error);
    expect(e.durationMs, 15000);
    expect(toasts.undoWindowOpen, isFalse);
  });

  test('the older toast keeps the bottom slot, the newer sits above', () {
    _show(toasts, 'a');
    clock.advance(1000);
    _show(toasts, 'b');
    expect(toasts.entries.map((UndoToastEntry e) => e.choreId), <String>[
      'a',
      'b',
    ]);
  });

  test('each toast has its own window', () {
    _show(toasts, 'a');
    clock.advance(5000);
    _show(toasts, 'b');
    clock.advance(3000);
    toasts.sweep();
    expect(toasts.entries.map((UndoToastEntry e) => e.choreId), <String>['b']);
    expect(toasts.windowOpenFor('a'), isFalse);
    expect(toasts.windowOpenFor('b'), isTrue);
  });

  test('a third toast closes the oldest, never reshuffles the others', () {
    _show(toasts, 'a');
    _show(toasts, 'b');
    _show(toasts, 'c');
    expect(toasts.entries.map((UndoToastEntry e) => e.choreId), <String>[
      'b',
      'c',
    ]);
  });

  test(
    'a second tap on the same card never shortens or restarts the window',
    () {
      final UndoToastEntry fresh = _show(toasts, 'a');
      clock.advance(300);
      final UndoToastEntry again = _show(
        toasts,
        'a',
        kind: UndoToastKind.revealed,
      );
      expect(identical(fresh, again), isTrue);
      expect(toasts.entries, hasLength(1));
      expect(toasts.entries.single.kind, UndoToastKind.fresh);
    },
  );

  test('a retry replaces the error toast of that chore', () {
    _show(toasts, 'a', kind: UndoToastKind.error);
    _show(toasts, 'a');
    expect(toasts.entries, hasLength(1));
    expect(toasts.entries.single.kind, UndoToastKind.fresh);
  });

  test('undoWindowOpen follows the fresh and revealed toasts', () {
    expect(toasts.undoWindowOpen, isFalse);
    final UndoToastEntry e = _show(toasts, 'a');
    expect(toasts.undoWindowOpen, isTrue);
    toasts.dismiss(e.key);
    expect(toasts.undoWindowOpen, isFalse);
  });
}
