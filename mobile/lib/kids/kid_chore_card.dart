/// Chore card (R4.1-R4.3): picto tile on the left, title and stars in the
/// middle, status ring on the right. The whole card is the tap target.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../models/chore.dart';
import 'chore_state.dart';
import 'kid_avatar.dart';
import 'kid_tap.dart';
import 'kid_theme.dart';
import 'picto.dart';
import 'picto_resolver.dart';

/// Card height on the phone (R4.2: at least 80). Scaled up with the text size
/// so two title lines always fit and every card of a group stays equally high.
double kidCardHeight(BuildContext context) {
  final double scale = MediaQuery.textScalerOf(context).scale(18) / 18;
  return 88 * scale.clamp(1.0, 1.6);
}

/// Centre of the render box behind [context] in global coordinates.
Offset _globalCenter(BuildContext context) {
  final RenderObject? box = context.findRenderObject();
  if (box is RenderBox && box.hasSize) {
    return box.localToGlobal(box.size.center(Offset.zero));
  }
  return Offset.zero;
}

/// Picto name of a chore, or null when no task motif fits (R3.2).
String? taskPictoOf(Chore chore) => resolveTaskPicto(chore.icon, chore.title);

/// The picture of a chore: its motif, or a star in the person's colour.
class KidTaskPicto extends StatelessWidget {
  const KidTaskPicto({
    required this.chore,
    required this.accentName,
    this.size = KidPictoSize.card,
    super.key,
  });

  final Chore chore;
  final String accentName;
  final double size;

  @override
  Widget build(BuildContext context) {
    final String? name = taskPictoOf(chore);
    if (name != null) {
      return KidPicto(name, size: size);
    }
    return Icon(
      Icons.star_rounded,
      size: size,
      color: context.kid.accent(accentName).base,
    );
  }
}

/// How the card looks. Derived by the board from the live data plus the
/// optimistic overlay.
class KidCardView {
  const KidCardView({
    required this.status,
    this.sending = false,
    this.failed = false,
    this.queued = false,
  });

  final ChoreStatus status;
  final bool sending;
  final bool failed;
  final bool queued;

  bool get done => status == ChoreStatus.done && !failed;
  bool get next => status == ChoreStatus.next && !failed;
}

class KidChoreCard extends StatefulWidget {
  const KidChoreCard({
    required this.chore,
    required this.view,
    required this.accentName,
    required this.height,
    required this.onPress,
    this.interactive = true,
    this.stamp,
    super.key,
  });

  final Chore chore;
  final KidCardView view;

  /// Colour of whoever the card belongs to; sand for "for everyone".
  final String accentName;
  final double height;

  /// Gets the card's centre in global coordinates (where the stars start
  /// flying). Returns false when a tap guard dropped the tap: the card then
  /// springs but nothing else happens (R5.5).
  final bool Function(Offset center) onPress;

  /// False on somebody else's board: the card is shown, not tappable.
  final bool interactive;

  /// Who did a "for everyone" chore today.
  final ChoreMember? stamp;

  @override
  State<KidChoreCard> createState() => _KidChoreCardState();
}

/// Marks the dimming layer of a card whose request is in flight.
const Key kKidCardSendingDimKey = ValueKey<String>('kid-card-sending-dim');

/// How often the "next" card plays its action (R3.4).
const Duration kNextDemoInterval = Duration(seconds: 12);

class _KidChoreCardState extends State<KidChoreCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _demo;
  Timer? _demoFirst;
  Timer? _demoRepeat;
  bool _blocked = false;
  Timer? _blockedTimer;

  @override
  void initState() {
    super.initState();
    _demo = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncDemo();
  }

  @override
  void didUpdateWidget(KidChoreCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.view.next != widget.view.next) {
      _syncDemo();
    }
  }

  void _syncDemo() {
    final bool play =
        widget.view.next && !MediaQuery.disableAnimationsOf(context);
    if (play && _demoRepeat == null) {
      _demoFirst = Timer(const Duration(milliseconds: 600), _playDemo);
      _demoRepeat = Timer.periodic(kNextDemoInterval, (Timer _) => _playDemo());
    } else if (!play) {
      _demoFirst?.cancel();
      _demoRepeat?.cancel();
      _demoFirst = null;
      _demoRepeat = null;
      _demo.value = 0;
    }
  }

  void _playDemo() {
    if (mounted) {
      unawaited(_demo.forward(from: 0));
    }
  }

  @override
  void dispose() {
    _demoFirst?.cancel();
    _demoRepeat?.cancel();
    _blockedTimer?.cancel();
    _demo.dispose();
    super.dispose();
  }

  void _handleTap() {
    final bool accepted = widget.onPress(_globalCenter(context));
    if (accepted) {
      return;
    }
    setState(() => _blocked = true);
    _blockedTimer?.cancel();
    _blockedTimer = Timer(const Duration(milliseconds: 180), () {
      if (mounted) {
        setState(() => _blocked = false);
      }
    });
  }

  String _stateWord(AppL10n l10n) {
    final KidCardView v = widget.view;
    if (v.failed) {
      return l10n.kidStateFailed;
    }
    if (v.sending) {
      return l10n.kidStateSending;
    }
    if (v.queued) {
      return l10n.kidStateQueued;
    }
    if (v.done) {
      return l10n.kidStateDone;
    }
    if (v.next) {
      return l10n.kidStateNext;
    }
    return l10n.kidStateOpen;
  }

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final AppL10n l10n = AppL10n.of(context);
    final KidAccent accent = tokens.accent(widget.accentName);
    final KidCardView view = widget.view;
    final bool reduced = MediaQuery.disableAnimationsOf(context);

    final Color bg = view.failed
        ? tokens.dangerTint
        : view.done
        ? accent.base
        : tokens.surface;
    final Color fg = view.failed
        ? tokens.dangerInk
        : view.done
        ? tokens.onAccent
        : tokens.ink;
    final Border? border = view.failed
        ? null
        : view.next
        ? Border.all(color: accent.base, width: 3)
        : Border.all(
            color: view.done ? Colors.transparent : tokens.border,
            width: 2,
          );

    final String label = l10n.kidCardLabel(
      widget.chore.title,
      widget.chore.points,
    );

    return KidTap(
      onTap: widget.interactive ? _handleTap : null,
      semanticLabel: label,
      semanticValue: _stateWord(l10n),
      checked: view.done,
      builder: (BuildContext context, KidTapState tap) {
        Widget card = TweenAnimationBuilder<Color?>(
          tween: ColorTween(end: bg),
          duration: Duration(milliseconds: reduced ? 120 : 220),
          curve: Curves.easeOut,
          builder: (BuildContext context, Color? fill, Widget? content) =>
              KidPressable(
                color: fill ?? bg,
                pressed: tap.pressed,
                border: border,
                child: content!,
              ),
          child: SizedBox(
            height: widget.height,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: DefaultTextStyle.merge(
                style: TextStyle(
                  color: fg,
                  decorationColor: fg,
                  decorationThickness: 2,
                ),
                child: Row(
                  children: <Widget>[
                    _PictoTile(
                      chore: widget.chore,
                      accentName: widget.accentName,
                      demo: _demo,
                      stamp: view.done ? widget.stamp : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _TitleBlock(chore: widget.chore, view: view),
                    ),
                    const SizedBox(width: 8),
                    _StatusRing(
                      view: view,
                      accent: accent,
                      tokens: tokens,
                      reduced: reduced,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
        if (view.sending) {
          // R4.1 "wird gesendet": the whole card is slightly dimmed, toward
          // the page background so it works in light and dark.
          card = Stack(
            children: <Widget>[
              card,
              Positioned.fill(
                child: IgnorePointer(
                  child: DecoratedBox(
                    key: kKidCardSendingDimKey,
                    decoration: BoxDecoration(
                      color: tokens.bg.withValues(alpha: 0.4),
                      borderRadius: KidRadius.cardBorder,
                    ),
                  ),
                ),
              ),
            ],
          );
        }
        if (view.failed) {
          card = CustomPaint(
            foregroundPainter: _DashedFramePainter(
              color: tokens.danger,
              radius: KidRadius.card,
            ),
            child: card,
          );
        }
        card = Stack(
          clipBehavior: Clip.none,
          children: <Widget>[
            card,
            if (view.next || view.failed)
              Positioned(
                left: -6,
                top: -6,
                child: _CornerBadge(picto: view.failed ? 'oops' : 'next'),
              ),
          ],
        );
        return AnimatedScale(
          scale: _blocked && !reduced ? 0.97 : 1,
          duration: const Duration(milliseconds: 120),
          child: AnimatedOpacity(
            opacity: _blocked && reduced ? 0.7 : 1,
            duration: const Duration(milliseconds: 120),
            child: card,
          ),
        );
      },
    );
  }
}

class _PictoTile extends StatelessWidget {
  const _PictoTile({
    required this.chore,
    required this.accentName,
    required this.demo,
    required this.stamp,
  });

  final Chore chore;
  final String accentName;
  final Animation<double> demo;
  final ChoreMember? stamp;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final KidAccent accent = tokens.accent(accentName);
    return SizedBox.square(
      dimension: 56,
      child: Stack(
        clipBehavior: Clip.none,
        children: <Widget>[
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: accent.tint,
                borderRadius: KidRadius.pictoTileBorder,
              ),
              child: Center(
                child: AnimatedBuilder(
                  animation: demo,
                  builder: (BuildContext context, Widget? child) {
                    final double t = demo.value;
                    final double angle =
                        math.sin(t * math.pi * 4) * 0.18 * (1 - t);
                    return Transform.rotate(angle: angle, child: child);
                  },
                  child: KidTaskPicto(chore: chore, accentName: accentName),
                ),
              ),
            ),
          ),
          if (stamp != null)
            Positioned(
              right: -8,
              bottom: -8,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: tokens.surface,
                ),
                child: KidAvatar(
                  name: stamp!.name,
                  color: stamp!.color,
                  emoji: stamp!.emoji,
                  diameter: 28,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _TitleBlock extends StatelessWidget {
  const _TitleBlock({required this.chore, required this.view});

  final Chore chore;
  final KidCardView view;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          chore.title,
          maxLines: KidText.taskTitleMaxLines,
          overflow: TextOverflow.ellipsis,
          style: KidText.title.copyWith(
            fontWeight: view.next ? FontWeight.w700 : FontWeight.w600,
            decoration: view.done ? TextDecoration.lineThrough : null,
          ),
        ),
        const SizedBox(height: 2),
        Row(
          children: <Widget>[
            const KidPicto('star', size: 20),
            const SizedBox(width: 4),
            Text(
              '+${chore.points}',
              style: KidText.label.copyWith(
                fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _StatusRing extends StatelessWidget {
  const _StatusRing({
    required this.view,
    required this.accent,
    required this.tokens,
    required this.reduced,
  });

  final KidCardView view;
  final KidAccent accent;
  final KidTokens tokens;
  final bool reduced;

  @override
  Widget build(BuildContext context) {
    final Color border = view.failed
        ? tokens.danger
        : view.done
        ? Colors.transparent
        : view.next
        ? accent.base
        : tokens.muted.withValues(alpha: 0.7);
    final Widget glyph;
    if (view.sending) {
      glyph = reduced
          ? _Dots(color: view.done ? accent.ink : tokens.muted)
          : SizedBox.square(
              dimension: 28,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                color: view.done ? accent.ink : tokens.muted,
              ),
            );
    } else if (view.failed) {
      glyph = Icon(Icons.refresh_rounded, size: 32, color: tokens.dangerInk);
    } else if (view.done && view.queued) {
      glyph = Icon(Icons.schedule_rounded, size: 28, color: accent.ink);
    } else if (view.done) {
      glyph = TweenAnimationBuilder<double>(
        tween: Tween<double>(begin: reduced ? 1 : 0.4, end: 1),
        duration: Duration(milliseconds: reduced ? 0 : 320),
        curve: Curves.easeOutBack,
        builder: (BuildContext context, double scale, Widget? child) =>
            Transform.scale(scale: scale, child: child),
        child: KidCheck(color: accent.ink, size: 36),
      );
    } else {
      glyph = const SizedBox.shrink();
    }

    return Container(
      width: 56,
      height: 56,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: border, width: 3),
        color: view.done || view.failed ? tokens.surface : null,
      ),
      child: glyph,
    );
  }
}

class _Dots extends StatelessWidget {
  const _Dots({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        for (int i = 0; i < 3; i++)
          Container(
            width: 6,
            height: 6,
            margin: const EdgeInsets.symmetric(horizontal: 2),
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
      ],
    );
  }
}

class _CornerBadge extends StatelessWidget {
  const _CornerBadge({required this.picto});

  final String picto;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    return Container(
      width: 36,
      height: 36,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: tokens.surface,
        boxShadow: KidElevation.pop(tokens),
      ),
      child: KidPicto(picto, size: 26),
    );
  }
}

class _DashedFramePainter extends CustomPainter {
  const _DashedFramePainter({required this.color, required this.radius});

  final Color color;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final Path path = Path()
      ..addRRect(
        RRect.fromRectAndRadius(
          (Offset.zero & size).deflate(1),
          Radius.circular(radius),
        ),
      );
    final Paint paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = color;
    for (final metric in path.computeMetrics()) {
      double distance = 0;
      while (distance < metric.length) {
        canvas.drawPath(metric.extractPath(distance, distance + 8), paint);
        distance += 14;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedFramePainter old) =>
      old.color != color || old.radius != radius;
}

/// One finished chore folded into the ✓-strip at the group end (R4.6). A tap
/// opens the undo toast; it never ticks again.
class KidDoneMini extends StatelessWidget {
  const KidDoneMini({
    required this.chore,
    required this.accentName,
    required this.done,
    required this.onPress,
    this.interactive = true,
    super.key,
  });

  final Chore chore;
  final String accentName;

  /// False while the strip is held in place after an undo: shows ○.
  final bool done;
  final bool Function(Offset center) onPress;
  final bool interactive;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final AppL10n l10n = AppL10n.of(context);
    final KidAccent accent = tokens.accent(accentName);
    return KidTap(
      onTap: interactive ? () => onPress(_globalCenter(context)) : null,
      semanticLabel: l10n.kidDoneMiniLabel(chore.title),
      checked: done,
      borderRadius: KidRadius.pictoTileBorder,
      builder: (BuildContext context, KidTapState tap) {
        return SizedBox.square(
          dimension: 56,
          child: Stack(
            clipBehavior: Clip.none,
            children: <Widget>[
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: accent.tint,
                    borderRadius: KidRadius.pictoTileBorder,
                  ),
                  child: Center(
                    child: KidTaskPicto(
                      chore: chore,
                      accentName: accentName,
                      size: 40,
                    ),
                  ),
                ),
              ),
              Positioned(
                right: -4,
                bottom: -4,
                child: Container(
                  width: 24,
                  height: 24,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: done ? accent.base : tokens.surface,
                    border: Border.all(
                      color: done ? tokens.surface : tokens.muted,
                      width: 2,
                    ),
                  ),
                  child: done
                      ? KidCheck(color: tokens.onAccent, size: 16)
                      : null,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
