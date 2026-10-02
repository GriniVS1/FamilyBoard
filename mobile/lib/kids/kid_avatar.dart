/// Person avatar (R6.1) and the check mark glyph shared by cards and badges.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'kid_theme.dart';

/// Hand-drawn check mark. Used instead of a Material icon so the stroke weight
/// matches the wall's bold ✓ at every size.
class KidCheck extends StatelessWidget {
  const KidCheck({required this.color, this.size = 28, super.key});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: _CheckPainter(color: color),
    );
  }
}

class _CheckPainter extends CustomPainter {
  const _CheckPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final Paint paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.15
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final Path path = Path()
      ..moveTo(size.width * 0.2, size.height * 0.54)
      ..lineTo(size.width * 0.42, size.height * 0.74)
      ..lineTo(size.width * 0.8, size.height * 0.28);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_CheckPainter oldDelegate) => oldDelegate.color != color;
}

/// Share of the diameter the emoji fills; R6.1 asks for at least 55 %.
const double kAvatarEmojiScale = 0.58;

/// Avatar sizes of the wall (`MemberAvatar`): diameter, ring, progress ring
/// and badge.
enum KidAvatarSize {
  sm(40, 2, 0, 0),
  md(56, 3, 4, 22),
  lg(72, 3, 5, 28),
  xl(96, 4, 6, 32);

  const KidAvatarSize(this.diameter, this.ring, this.progress, this.badge);

  final double diameter;
  final double ring;
  final double progress;
  final double badge;
}

/// Emoji (or initial) on the person's tint, a ring in the person's colour,
/// an optional day-progress ring and an open-count badge (✓ on success when 0).
class KidAvatar extends StatelessWidget {
  const KidAvatar({
    required this.name,
    required this.color,
    required this.emoji,
    this.size = KidAvatarSize.md,
    this.progress,
    this.openCount,
    this.semanticLabel,
    this.diameter,
    super.key,
  });

  final String name;

  /// One of the 8 accent names.
  final String color;
  final String emoji;
  final KidAvatarSize size;

  /// Today's chores. Pass only when `total > 0`.
  final ({int done, int total})? progress;

  /// Open chores today: > 0 shows the number, 0 shows a ✓. Null: no badge.
  final int? openCount;

  /// Overrides the spoken label (default: the name). Pass the localized
  /// "name, n open" string from the caller.
  final String? semanticLabel;

  /// Overrides [KidAvatarSize.diameter] for stamps on a picto tile.
  final double? diameter;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final KidAccent accent = tokens.accent(color);
    final double d = diameter ?? size.diameter;
    final double halo = progress == null ? 0 : size.progress + 2;
    final double outer = d + halo * 2;
    final String initial = name.trim().isEmpty
        ? '?'
        : name.trim().characters.first.toUpperCase();
    final bool hasEmoji = emoji.trim().isNotEmpty;

    return Semantics(
      container: true,
      label: semanticLabel ?? name,
      image: true,
      excludeSemantics: true,
      child: SizedBox.square(
        dimension: outer,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: <Widget>[
            if (progress != null && progress!.total > 0)
              Positioned.fill(
                child: CustomPaint(
                  painter: _ProgressRingPainter(
                    fraction: progress!.done / progress!.total,
                    stroke: size.progress,
                    track: tokens.border,
                    fill: accent.base,
                  ),
                ),
              ),
            Container(
              width: d,
              height: d,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: accent.tint,
                border: Border.all(color: accent.base, width: size.ring),
              ),
              child: hasEmoji
                  ? Text(
                      emoji,
                      textScaler: TextScaler.noScaling,
                      style: TextStyle(fontSize: d * kAvatarEmojiScale),
                    )
                  : Text(
                      initial,
                      textScaler: TextScaler.noScaling,
                      style: KidText.titleLg.copyWith(
                        color: accent.ink,
                        fontSize: d * 0.42,
                      ),
                    ),
            ),
            if (openCount != null && size.badge > 0)
              Positioned(
                top: -2,
                right: -2,
                child: _CountBadge(count: openCount!, diameter: size.badge),
              ),
          ],
        ),
      ),
    );
  }
}

class _CountBadge extends StatelessWidget {
  const _CountBadge({required this.count, required this.diameter});

  final int count;
  final double diameter;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final bool done = count == 0;
    return Container(
      constraints: BoxConstraints(minWidth: diameter, minHeight: diameter),
      padding: const EdgeInsets.symmetric(horizontal: 4),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: count > 9 ? BoxShape.rectangle : BoxShape.circle,
        borderRadius: count > 9 ? BorderRadius.circular(diameter) : null,
        color: done ? tokens.success : tokens.ink,
        border: Border.all(color: tokens.surface, width: 2),
      ),
      child: done
          ? KidCheck(color: tokens.surface, size: diameter * 0.7)
          : Text(
              '$count',
              textScaler: TextScaler.noScaling,
              style: KidText.label.copyWith(
                color: tokens.bg,
                fontSize: diameter * 0.55,
                height: 1,
                fontWeight: FontWeight.w700,
                fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
              ),
            ),
    );
  }
}

class _ProgressRingPainter extends CustomPainter {
  const _ProgressRingPainter({
    required this.fraction,
    required this.stroke,
    required this.track,
    required this.fill,
  });

  final double fraction;
  final double stroke;
  final Color track;
  final Color fill;

  @override
  void paint(Canvas canvas, Size size) {
    final Rect rect = (Offset.zero & size).deflate(stroke / 2);
    final Paint base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = track;
    canvas.drawArc(rect, 0, math.pi * 2, false, base);
    if (fraction <= 0) {
      return;
    }
    final Paint arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = fill;
    canvas.drawArc(
      rect,
      -math.pi / 2,
      math.pi * 2 * fraction.clamp(0.0, 1.0),
      false,
      arc,
    );
  }

  @override
  bool shouldRepaint(_ProgressRingPainter old) =>
      old.fraction != fraction ||
      old.stroke != stroke ||
      old.track != track ||
      old.fill != fill;
}
