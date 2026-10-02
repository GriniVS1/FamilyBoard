/// Port of the wall's `use-held-layout.ts` (R5.4) without any widget: keeps
/// showing the previous layout while the layout-relevant signature changes
/// under a child who is still tapping.
library;

import 'tap_guards.dart';

/// Holds a layout snapshot of type [T].
///
/// [update] is called with the live layout and its signature on every build.
/// The previous snapshot stays until the list has been left alone for
/// [kLayoutQuietMs] **and** no undo window is open (both checked through the
/// [TapGuard]); any touch restarts that wait. Without interaction a change
/// applies at once. [tick] re-checks while held.
class HeldLayout<T> {
  HeldLayout({
    required this._guard,
    required T initial,
    required String signature,
    this._onShift,
  }) : _value = initial,
       _signature = signature,
       _latest = initial,
       _latestSignature = signature;

  final TapGuard _guard;
  final void Function()? _onShift;

  T _value;
  String _signature;
  T _latest;
  String _latestSignature;

  /// The layout to render.
  T get value => _value;

  String get signature => _signature;

  /// True while a newer layout is waiting for the finger to leave.
  bool get held => _latestSignature != _signature;

  void update(T live, String liveSignature, {required bool windowOpen}) {
    _latest = live;
    _latestSignature = liveSignature;
    if (!held) {
      return;
    }
    if (_guard.shouldHoldLayout(windowOpen: windowOpen)) {
      return;
    }
    _adopt();
  }

  /// Re-checks a held layout. Returns true when it was released and the
  /// caller has to rebuild.
  bool tick({required bool windowOpen}) {
    if (!held || _guard.shouldHoldLayout(windowOpen: windowOpen)) {
      return false;
    }
    _adopt();
    return true;
  }

  void _adopt() {
    _value = _latest;
    _signature = _latestSignature;
    _onShift?.call();
  }
}
