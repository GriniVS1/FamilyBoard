/// The undo toast of the phone (R5.2): an opaque full-width bar that sits
/// directly on top of the bottom navigation, with a strip above it that
/// swallows taps, so a finger aimed at a card near the bar can never land on
/// the ↶. Place [UndoToastHost] at the bottom of the screen body.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../state/undo_toast_provider.dart';
import 'kid_avatar.dart';
import 'kid_tap.dart';
import 'kid_theme.dart';
import 'picto.dart';
import 'picto_resolver.dart';
import 'tap_guards.dart';
import 'undo_toast_controller.dart';

/// Height of one bar and of the tap-swallowing strip above the stack.
const double kToastBarHeight = 76;
const double kToastBufferHeight = 16;

/// Bottom padding a list needs so the open toasts never cover its last card
/// (R5.2: permanent, so nothing jumps when a toast appears).
const double kToastListPadding =
    kToastBarHeight * UndoToastController.maxStack + kToastBufferHeight + 8;

/// Stacks the open toasts: the oldest keeps the bottom slot, newer ones sit
/// above it, each with its own ↶.
class UndoToastHost extends ConsumerWidget {
  const UndoToastHost({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final UndoToastController controller = ref.watch(undoToastProvider);
    return ListenableBuilder(
      listenable: controller,
      builder: (BuildContext context, Widget? _) {
        final List<UndoToastEntry> entries = controller.entries;
        if (entries.isEmpty) {
          return const SizedBox.shrink();
        }
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {},
              onVerticalDragStart: (DragStartDetails _) {},
              child: const SizedBox(height: kToastBufferHeight),
            ),
            for (final UndoToastEntry entry in entries.reversed)
              UndoToastBar(
                key: ValueKey<int>(entry.key),
                entry: entry,
                clock: controller.clock,
                onClose: () => controller.dismiss(entry.key),
              ),
          ],
        );
      },
    );
  }
}

class UndoToastBar extends StatefulWidget {
  const UndoToastBar({
    required this.entry,
    required this.clock,
    required this.onClose,
    super.key,
  });

  final UndoToastEntry entry;
  final DateTime Function() clock;
  final VoidCallback onClose;

  @override
  State<UndoToastBar> createState() => _UndoToastBarState();
}

class _UndoToastBarState extends State<UndoToastBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _countdown;
  Timer? _armTimer;
  bool _armed = false;

  @override
  void initState() {
    super.initState();
    final UndoToastEntry e = widget.entry;
    final int remaining = e.expiresAt
        .difference(widget.clock())
        .inMilliseconds
        .clamp(1, e.durationMs);
    _countdown = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: remaining),
      value: 1,
    );
    _armed = isUndoArmed(e.shownAt, widget.clock());
    if (!_armed) {
      final int wait =
          kUndoArmMs - widget.clock().difference(e.shownAt).inMilliseconds;
      _armTimer = Timer(Duration(milliseconds: math.max(1, wait)), () {
        if (mounted) {
          setState(() => _armed = true);
        }
      });
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final bool reduced = MediaQuery.disableAnimationsOf(context);
    if (reduced) {
      _countdown.stop();
      _countdown.value = 1;
    } else if (!_countdown.isAnimating && _countdown.value == 1) {
      unawaited(_countdown.reverse(from: 1));
    }
  }

  @override
  void dispose() {
    _armTimer?.cancel();
    _countdown.dispose();
    super.dispose();
  }

  void _undo() {
    if (!isUndoArmed(widget.entry.shownAt, widget.clock())) {
      return;
    }
    widget.entry.onUndo?.call();
  }

  void _retry() {
    widget.onClose();
    widget.entry.onRetry?.call();
  }

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final AppL10n l10n = AppL10n.of(context);
    final UndoToastEntry e = widget.entry;
    final bool error = e.kind == UndoToastKind.error;
    final Color bg = error ? tokens.dangerTint : tokens.successTint;
    final Color edge = error ? tokens.danger : tokens.success;
    final Color ink = error ? tokens.dangerInk : tokens.successInk;
    final String picto = resolveTaskPicto(e.icon, e.title) ?? 'star';
    final bool reduced = MediaQuery.disableAnimationsOf(context);

    final Widget avatar = KidAvatar(
      name: e.memberName,
      color: e.memberColor,
      emoji: e.memberEmoji,
      size: KidAvatarSize.sm,
    );

    final Widget leading;
    switch (e.kind) {
      case UndoToastKind.fresh:
      case UndoToastKind.revealed:
        leading = _UndoButton(
          armed: _armed,
          label: l10n.kidUndoTask(e.title),
          memberColor: e.memberColor,
          countdown: _countdown,
          showCountdown: e.kind == UndoToastKind.fresh,
          reducedMotion: reduced,
          onTap: _undo,
        );
      case UndoToastKind.error:
        leading = KidRoundButton(
          semanticLabel: l10n.kidRetryTask(e.title),
          onTap: _retry,
          color: tokens.surface,
          borderColor: tokens.danger,
          child: Icon(Icons.refresh_rounded, size: 32, color: tokens.dangerInk),
        );
      case UndoToastKind.info:
        leading = const SizedBox.shrink();
    }

    final Widget body;
    if (error) {
      body = Row(
        children: <Widget>[
          KidPicto(picto, size: 40),
          const SizedBox(width: 8),
          const KidPicto('oops', size: 40),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              switch (e.errorLine) {
                ToastErrorLine.queueFull => l10n.kidErrorQueueFull,
                ToastErrorLine.undoFailed => l10n.kidErrorUndoFailed,
                _ => l10n.kidErrorGeneric,
              },
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: KidText.label.copyWith(color: ink),
            ),
          ),
        ],
      );
    } else {
      body = Row(
        children: <Widget>[
          KidPicto(picto, size: 44),
          const SizedBox(width: 8),
          avatar,
          const Spacer(),
          const KidPicto('star', size: 28),
          const SizedBox(width: 4),
          Text('+${e.points}', style: KidText.number.copyWith(color: ink)),
        ],
      );
    }

    final String spoken = switch (e.kind) {
      UndoToastKind.error => switch (e.errorLine) {
        ToastErrorLine.queueFull => l10n.kidErrorQueueFull,
        ToastErrorLine.undoFailed => l10n.kidErrorUndoFailed,
        _ => l10n.kidErrorGeneric,
      },
      UndoToastKind.info => l10n.kidToastDoneBy(e.memberName, e.points),
      _ => l10n.kidToastStars(e.memberName, e.points),
    };

    final Widget bar = Semantics(
      container: true,
      liveRegion: true,
      label: spoken,
      child: Material(
        color: bg,
        child: Container(
          constraints: const BoxConstraints(minHeight: kToastBarHeight),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            border: Border(top: BorderSide(color: edge, width: 2)),
          ),
          child: Row(
            children: <Widget>[
              if (e.kind != UndoToastKind.info) ...<Widget>[
                leading,
                const SizedBox(width: 12),
              ],
              Expanded(child: body),
            ],
          ),
        ),
      ),
    );

    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: 1),
      duration: Duration(milliseconds: reduced ? 120 : 200),
      curve: Curves.easeOut,
      builder: (BuildContext context, double t, Widget? child) {
        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, reduced ? 0 : (1 - t) * 24),
            child: child,
          ),
        );
      },
      child: bar,
    );
  }
}

/// ↶ with the countdown ring. Inert and invisible until armed (600 ms), so it
/// is never visible but dead: it appears exactly when it starts to work.
class _UndoButton extends StatelessWidget {
  const _UndoButton({
    required this.armed,
    required this.label,
    required this.memberColor,
    required this.countdown,
    required this.showCountdown,
    required this.reducedMotion,
    required this.onTap,
  });

  final bool armed;
  final String label;
  final String memberColor;
  final Animation<double> countdown;
  final bool showCountdown;
  final bool reducedMotion;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final KidAccent accent = tokens.accent(memberColor);
    return SizedBox.square(
      dimension: 64,
      child: AnimatedOpacity(
        opacity: armed ? 1 : 0,
        duration: Duration(milliseconds: reducedMotion ? 0 : 200),
        child: IgnorePointer(
          ignoring: !armed,
          child: Stack(
            alignment: Alignment.center,
            children: <Widget>[
              if (showCountdown)
                Positioned.fill(
                  child: AnimatedBuilder(
                    animation: countdown,
                    builder: (BuildContext context, Widget? _) => CustomPaint(
                      painter: _CountdownPainter(
                        fraction: countdown.value,
                        color: accent.base,
                        stroke: 5,
                      ),
                    ),
                  ),
                ),
              KidRoundButton(
                semanticLabel: label,
                onTap: armed ? onTap : null,
                child: const KidPicto('undo', size: 32),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CountdownPainter extends CustomPainter {
  const _CountdownPainter({
    required this.fraction,
    required this.color,
    required this.stroke,
  });

  final double fraction;
  final Color color;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final Rect rect = (Offset.zero & size).deflate(stroke / 2);
    final Paint paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = color;
    canvas.drawArc(rect, -math.pi / 2, math.pi * 2 * fraction, false, paint);
  }

  @override
  bool shouldRepaint(_CountdownPainter old) =>
      old.fraction != fraction || old.color != color || old.stroke != stroke;
}
