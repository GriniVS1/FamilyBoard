/// State of the undo toasts (R5.2, R5.3): which toast is open, until when,
/// and in which order they stack. No widgets here; see `undo_toast.dart`.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';

import 'tap_guards.dart';
import 'time_of_day.dart';

enum UndoToastKind {
  /// Just ticked: ↶ for 8 s with a countdown ring.
  fresh,

  /// A tap on an older done card: ↶ for 5 s.
  revealed,

  /// A "for everyone" chore somebody else finished: nothing to undo from this
  /// phone, the toast only shows who earned the stars.
  info,

  /// The request failed: oops and ↻.
  error,
}

/// Short, localized lines for adults under an error toast (R5.7). Never raw
/// server or exception text.
enum ToastErrorLine { generic, queueFull, undoFailed }

class UndoToastEntry {
  UndoToastEntry({
    required this.key,
    required this.kind,
    required this.choreId,
    required this.title,
    required this.icon,
    required this.points,
    required this.memberName,
    required this.memberColor,
    required this.memberEmoji,
    required this.shownAt,
    required this.expiresAt,
    this.onUndo,
    this.onRetry,
    this.errorLine,
  });

  final int key;
  final UndoToastKind kind;
  final String choreId;
  final String title;

  /// The chore's stored `icon` (canonical emoji); resolved to a picto at
  /// render time.
  final String? icon;
  final int points;
  final String memberName;
  final String memberColor;
  final String memberEmoji;
  final DateTime shownAt;
  final DateTime expiresAt;
  final VoidCallback? onUndo;
  final VoidCallback? onRetry;
  final ToastErrorLine? errorLine;

  /// A ↶ window that holds the lists' layout still (R5.4).
  bool get isUndoWindow =>
      kind == UndoToastKind.fresh || kind == UndoToastKind.revealed;

  int get durationMs => expiresAt.difference(shownAt).inMilliseconds;
}

/// Owns the open toasts. Older toasts keep the bottom slot, newer ones sit on
/// top (R5.3). At most [maxStack] are open: a further one closes the oldest.
class UndoToastController extends ChangeNotifier {
  UndoToastController({required this._clock});

  static const int maxStack = 2;

  final Clock _clock;
  final List<UndoToastEntry> _entries = <UndoToastEntry>[];
  Timer? _timer;
  int _seq = 0;
  bool _disposed = false;

  Clock get clock => _clock;

  /// Oldest first: index 0 is the bottom slot.
  List<UndoToastEntry> get entries =>
      List<UndoToastEntry>.unmodifiable(_entries);

  bool get isEmpty => _entries.isEmpty;

  /// Whether any ↶ window is open (layout must hold still).
  bool get undoWindowOpen => _entries.any((UndoToastEntry e) => e.isUndoWindow);

  bool windowOpenFor(String choreId) => _entries.any(
    (UndoToastEntry e) => e.isUndoWindow && e.choreId == choreId,
  );

  UndoToastEntry? entryFor(String choreId) {
    for (final UndoToastEntry e in _entries) {
      if (e.choreId == choreId) {
        return e;
      }
    }
    return null;
  }

  /// Opens a toast. A revealed toast never replaces an open window of the
  /// same chore (a second tap must not shorten or restart the ↶ window); any
  /// other kind replaces what that chore currently shows.
  UndoToastEntry show({
    required UndoToastKind kind,
    required String choreId,
    required String title,
    required String? icon,
    required int points,
    required String memberName,
    required String memberColor,
    required String memberEmoji,
    VoidCallback? onUndo,
    VoidCallback? onRetry,
    ToastErrorLine? errorLine,
  }) {
    final UndoToastEntry? existing = entryFor(choreId);
    if (existing != null &&
        kind == UndoToastKind.revealed &&
        (existing.isUndoWindow || existing.kind == UndoToastKind.info)) {
      return existing;
    }
    if (existing != null) {
      _entries.remove(existing);
    }
    final DateTime now = _clock();
    final int ms = switch (kind) {
      UndoToastKind.fresh => kFreshUndoMs,
      UndoToastKind.revealed => kRevealedUndoMs,
      UndoToastKind.info => kRevealedUndoMs,
      UndoToastKind.error => kErrorToastMs,
    };
    _seq += 1;
    final UndoToastEntry entry = UndoToastEntry(
      key: _seq,
      kind: kind,
      choreId: choreId,
      title: title,
      icon: icon,
      points: points,
      memberName: memberName,
      memberColor: memberColor,
      memberEmoji: memberEmoji,
      shownAt: now,
      expiresAt: now.add(Duration(milliseconds: ms)),
      onUndo: onUndo,
      onRetry: onRetry,
      errorLine: errorLine,
    );
    _entries.add(entry);
    while (_entries.length > maxStack) {
      _entries.removeAt(0);
    }
    _reschedule();
    notifyListeners();
    return entry;
  }

  void dismiss(int key) {
    final int before = _entries.length;
    _entries.removeWhere((UndoToastEntry e) => e.key == key);
    if (_entries.length != before) {
      _reschedule();
      notifyListeners();
    }
  }

  void dismissChore(String choreId) {
    final int before = _entries.length;
    _entries.removeWhere((UndoToastEntry e) => e.choreId == choreId);
    if (_entries.length != before) {
      _reschedule();
      notifyListeners();
    }
  }

  /// Drops every toast whose window has closed. Called by the timer; tests
  /// with a fake clock call it directly.
  void sweep() {
    final DateTime now = _clock();
    final int before = _entries.length;
    _entries.removeWhere((UndoToastEntry e) => !e.expiresAt.isAfter(now));
    _reschedule();
    if (_entries.length != before) {
      notifyListeners();
    }
  }

  void _reschedule() {
    _timer?.cancel();
    _timer = null;
    if (_entries.isEmpty || _disposed) {
      return;
    }
    DateTime next = _entries.first.expiresAt;
    for (final UndoToastEntry e in _entries) {
      if (e.expiresAt.isBefore(next)) {
        next = e.expiresAt;
      }
    }
    final Duration wait = next.difference(_clock());
    _timer = Timer(wait.isNegative ? Duration.zero : wait, sweep);
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    _timer = null;
    super.dispose();
  }
}
