/// Star counter of a person and the stars that fly into it (R5.6, R6.2).
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import 'kid_theme.dart';
import 'picto.dart';
import 'points.dart';

/// Pill with a star and the person's number. [count] null = still loading:
/// a skeleton, never "0" (R9.1). Pulses and shows a "+N" chip when the number
/// grows; with reduced motion the number just cross-fades (R5.8).
class KidStarCounter extends StatefulWidget {
  const KidStarCounter({
    required this.count,
    this.name = '',
    this.compact = false,
    super.key,
  });

  final StarCount? count;
  final String name;
  final bool compact;

  @override
  State<KidStarCounter> createState() => _KidStarCounterState();
}

/// Up to 130 % and back to exactly 1.0. A sequence, not a sine curve: the
/// animation's end value is the rest value, so the counter can never stay
/// enlarged.
final Animatable<double> _pulseScale =
    TweenSequence<double>(<TweenSequenceItem<double>>[
      TweenSequenceItem<double>(
        tween: Tween<double>(
          begin: 1,
          end: 1.3,
        ).chain(CurveTween(curve: Curves.easeOut)),
        weight: 1,
      ),
      TweenSequenceItem<double>(
        tween: Tween<double>(
          begin: 1.3,
          end: 1,
        ).chain(CurveTween(curve: Curves.easeInOut)),
        weight: 1,
      ),
    ]);

class _KidStarCounterState extends State<KidStarCounter>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  Timer? _chipTimer;
  int _delta = 0;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
  }

  @override
  void didUpdateWidget(KidStarCounter oldWidget) {
    super.didUpdateWidget(oldWidget);
    final int? before = oldWidget.count?.value;
    final int? after = widget.count?.value;
    if (before != null && after != null && after > before) {
      _delta = after - before;
      _chipTimer?.cancel();
      _chipTimer = Timer(const Duration(milliseconds: 1600), () {
        if (mounted) {
          setState(() => _delta = 0);
        }
      });
      if (!MediaQuery.disableAnimationsOf(context)) {
        unawaited(_pulse.forward(from: 0));
      }
    }
  }

  @override
  void dispose() {
    _chipTimer?.cancel();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final AppL10n l10n = AppL10n.of(context);
    final StarCount? count = widget.count;
    final bool today = count?.scope == StarScope.today;
    final bool reduced = MediaQuery.disableAnimationsOf(context);
    final double height = widget.compact ? 32 : 40;

    final String spoken = count == null
        ? l10n.kidLoading
        : today
        ? l10n.kidStarsToday(count.value)
        : l10n.kidStarsBalance(count.value);

    final Widget number = count == null
        ? Container(
            width: 24,
            height: 18,
            decoration: BoxDecoration(
              color: tokens.border,
              borderRadius: BorderRadius.circular(9),
            ),
          )
        : AnimatedSwitcher(
            duration: Duration(milliseconds: reduced ? 150 : 200),
            child: Text(
              '${count.value}',
              key: ValueKey<int>(count.value),
              style: KidText.number.copyWith(color: tokens.ink),
            ),
          );

    return Semantics(
      label: widget.name.isEmpty ? spoken : '${widget.name}: $spoken',
      excludeSemantics: true,
      child: Stack(
        clipBehavior: Clip.none,
        children: <Widget>[
          ScaleTransition(
            scale: _pulseScale.animate(_pulse),
            child: Container(
              height: height,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: tokens.surface,
                borderRadius: BorderRadius.circular(height),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  KidPicto('star', size: widget.compact ? 20 : 24),
                  const SizedBox(width: 6),
                  number,
                  if (today) ...<Widget>[
                    const SizedBox(width: 6),
                    Text(
                      l10n.kidStarsTodayShort,
                      style: KidText.label.copyWith(color: tokens.muted),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (_delta > 0)
            Positioned(
              right: -6,
              top: -14,
              child: TweenAnimationBuilder<double>(
                tween: Tween<double>(begin: reduced ? 1 : 0, end: 1),
                duration: Duration(milliseconds: reduced ? 0 : 260),
                curve: Curves.easeOutBack,
                builder: (BuildContext context, double t, Widget? child) =>
                    Transform.scale(scale: t, child: child),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: tokens.success,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '+$_delta',
                    style: KidText.label.copyWith(color: tokens.surface),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Stars that fly from a ticked card to the person's counter (R5.6). Skipped
/// entirely with reduced motion (R5.8): the counter's number change is the
/// whole feedback.
class KidStarFlight {
  const KidStarFlight._();

  /// Returns whether a flight started (false with reduced motion, or when the
  /// counter is not on screen).
  static bool play(
    BuildContext context, {
    required Offset from,
    required GlobalKey? target,
    required int stars,
  }) {
    if (MediaQuery.disableAnimationsOf(context)) {
      return false;
    }
    final RenderObject? box = target?.currentContext?.findRenderObject();
    if (box is! RenderBox || !box.hasSize || !box.attached) {
      return false;
    }
    final Offset to = box.localToGlobal(box.size.center(Offset.zero));
    final OverlayState overlay = Overlay.of(context);
    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (BuildContext context) => _Flight(
        from: from,
        to: to,
        count: stars.clamp(1, 5),
        onDone: () => entry.remove(),
      ),
    );
    overlay.insert(entry);
    return true;
  }
}

class _Flight extends StatefulWidget {
  const _Flight({
    required this.from,
    required this.to,
    required this.count,
    required this.onDone,
  });

  final Offset from;
  final Offset to;
  final int count;
  final VoidCallback onDone;

  @override
  State<_Flight> createState() => _FlightState();
}

class _FlightState extends State<_Flight> with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 750),
    );
    unawaited(
      _c.forward().whenComplete(() {
        if (mounted) {
          widget.onDone();
        }
      }),
    );
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _c,
        builder: (BuildContext context, Widget? _) {
          return Stack(
            children: <Widget>[for (int i = 0; i < widget.count; i++) _star(i)],
          );
        },
      ),
    );
  }

  Widget _star(int i) {
    final double delay = i * 0.08;
    final double t = Curves.easeInOutCubic.transform(
      ((_c.value - delay) / (1 - delay)).clamp(0.0, 1.0),
    );
    final Offset a = widget.from;
    final Offset b = widget.to;
    final double spread = (i - (widget.count - 1) / 2) * 28;
    final Offset control = Offset(
      (a.dx + b.dx) / 2 + spread,
      math.min(a.dy, b.dy) - 60,
    );
    final double mt = 1 - t;
    final Offset p = a * (mt * mt) + control * (2 * mt * t) + b * (t * t);
    return Positioned(
      left: p.dx - 14,
      top: p.dy - 14,
      child: Opacity(
        opacity: t < 0.9 ? 1 : (1 - t) * 10,
        child: Transform.scale(
          scale: 1 - 0.35 * t,
          child: const KidPicto('star', size: 28),
        ),
      ),
    );
  }
}
