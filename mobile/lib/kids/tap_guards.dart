/// Port of `src/lib/tap-guards.ts` and `src/lib/undo-guard.ts` (R5.3-R5.5):
/// the pure rules behind "nothing moves under a child who is tapping".
/// No widgets; every time read goes through an injected [Clock].
library;

import 'time_of_day.dart';

/// After a tick, taps on other cards of the same list are ignored this long
/// (a double tap is < 500 ms).
const int kColumnTapLockMs = 600;

/// Taps this soon after cards moved are dropped: the finger aimed at the old
/// picture.
const int kLayoutTapGuardMs = 600;

/// A scroll gesture leaves taps in the scrolled list unreliable for this long.
const int kScrollTapGuardMs = 300;

/// A list keeps its layout until it has been left alone this long and no
/// undo window is open.
const int kLayoutQuietMs = 3000;

/// A freshly shown undo button stays inert for this long, so the second tap of
/// a child's double tap cannot undo what the first tap just did.
const int kUndoArmMs = 600;

/// Undo window after a fresh tick (R5.3).
const int kFreshUndoMs = 8000;

/// Undo window after a tap on an older done card (R5.3).
const int kRevealedUndoMs = 5000;

/// How long an error toast stays (wall: `ERROR_TOAST_MS`).
const int kErrorToastMs = 15000;

/// Key for scrolls outside any list: the whole page moved.
const String kPageScrollKey = 'page';

bool isUndoArmed(DateTime shownAt, DateTime now, {int armMs = kUndoArmMs}) =>
    now.difference(shownAt).inMilliseconds >= armMs;

/// Why a tap was (not) accepted.
enum TapVerdict {
  allowed,

  /// Another card of the same list was ticked < 600 ms ago.
  columnLocked,

  /// Cards of this list moved < 600 ms ago.
  layoutShifted,

  /// The list was scrolled < 300 ms ago.
  scrolling;

  bool get isAllowed => this == TapVerdict.allowed;
}

/// Per-list tap bookkeeping. One instance can serve several lists (Heute and
/// Aufgaben): every call carries the list key.
class TapGuard {
  TapGuard({required this._clock});

  final Clock _clock;

  ({String listKey, String choreId, DateTime at})? _lastCompletion;
  final Map<String, DateTime> _shifts = <String, DateTime>{};
  final Map<String, DateTime> _scrolls = <String, DateTime>{};
  DateTime? _lastTouchAt;

  /// A finger touched the list (any pointer-down).
  void touch() => _lastTouchAt = _clock();

  DateTime? get lastTouchAt => _lastTouchAt;

  void recordCompletion(String listKey, String choreId) {
    _lastCompletion = (listKey: listKey, choreId: choreId, at: _clock());
  }

  /// Cards of [listKey] just moved (a held layout was released, a group
  /// opened or closed).
  void recordLayoutShift(String listKey) => _shifts[listKey] = _clock();

  void recordScroll(String listKey) => _scrolls[listKey] = _clock();

  TapVerdict check(String listKey, String choreId) {
    final DateTime now = _clock();
    if (!columnTapAllowed(_lastCompletion, listKey, choreId, now)) {
      return TapVerdict.columnLocked;
    }
    final DateTime? shift = _shifts[listKey];
    if (!layoutTapAllowed(shift, now)) {
      return TapVerdict.layoutShifted;
    }
    if (!scrollTapAllowedIn(_scrolls, listKey, now)) {
      return TapVerdict.scrolling;
    }
    return TapVerdict.allowed;
  }

  /// Whether a layout change must still wait (R5.4): a finger was on the list
  /// within [kLayoutQuietMs], or an undo window is open.
  bool shouldHoldLayout({required bool windowOpen}) {
    return shouldHoldLayoutAt(
      now: _clock(),
      lastTouchAt: _lastTouchAt,
      windowOpen: windowOpen,
    );
  }
}

/// After a tick, taps on a different card of the same list are locked for
/// [lockMs]. The same card, another list, or no previous tick: allowed.
bool columnTapAllowed(
  ({String listKey, String choreId, DateTime at})? last,
  String listKey,
  String choreId,
  DateTime now, {
  int lockMs = kColumnTapLockMs,
}) {
  if (last == null || last.listKey != listKey || last.choreId == choreId) {
    return true;
  }
  return now.difference(last.at).inMilliseconds >= lockMs;
}

bool layoutTapAllowed(
  DateTime? lastShiftAt,
  DateTime now, {
  int guardMs = kLayoutTapGuardMs,
}) {
  return lastShiftAt == null ||
      now.difference(lastShiftAt).inMilliseconds >= guardMs;
}

/// A scroll only invalidates taps in the list that scrolled (or after a page
/// scroll, everywhere). A sibling's list must not lose a tap to it.
bool scrollTapAllowedIn(
  Map<String, DateTime> scrolls,
  String listKey,
  DateTime now, {
  int guardMs = kScrollTapGuardMs,
}) {
  final DateTime? list = scrolls[listKey];
  final DateTime? page = scrolls[kPageScrollKey];
  return (list == null || now.difference(list).inMilliseconds >= guardMs) &&
      (page == null || now.difference(page).inMilliseconds >= guardMs);
}

bool shouldHoldLayoutAt({
  required DateTime now,
  required DateTime? lastTouchAt,
  required bool windowOpen,
  int quietMs = kLayoutQuietMs,
}) {
  if (windowOpen) {
    return true;
  }
  return lastTouchAt != null &&
      now.difference(lastTouchAt).inMilliseconds < quietMs;
}
