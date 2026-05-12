import 'package:flutter/material.dart';

/// FamilyBoard wordmark for the mobile app.
///
/// Visual: "Family" in coral, "Board" in ink (theme.colorScheme.onSurface),
/// with the "o" replaced by a bullseye (dark ring + coral center).
/// Mirrors `src/components/shared/logo.tsx` on the wall side.
///
/// Sized by `fontSize`. The bullseye scales with the font.
class FamilyBoardLogo extends StatelessWidget {
  const FamilyBoardLogo({super.key, this.fontSize = 22, this.semanticsLabel});

  final double fontSize;
  final String? semanticsLabel;

  /// Brand coral — must stay in sync with `--brand-coral` on the wall (HSL 9 75% 62%).
  static const Color brandCoral = Color(0xFFE6745A);

  @override
  Widget build(BuildContext context) {
    final Color ink = Theme.of(context).colorScheme.onSurface;
    final TextStyle base = TextStyle(
      fontSize: fontSize,
      fontWeight: FontWeight.w700,
      height: 1.0,
      letterSpacing: -0.2,
    );
    final double dotSize = fontSize * 0.6;

    return Semantics(
      label: semanticsLabel ?? 'FamilyBoard',
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: <Widget>[
          Text('Family', style: base.copyWith(color: brandCoral)),
          Text('B', style: base.copyWith(color: ink)),
          // Optical kerning around the bullseye glyph.
          SizedBox(width: fontSize * 0.02),
          Padding(
            // Pull the donut down to sit at x-height level
            padding: EdgeInsets.only(bottom: fontSize * 0.03),
            child: CustomPaint(
              size: Size(dotSize, dotSize),
              painter: _BullseyePainter(ringColor: ink, dotColor: brandCoral),
            ),
          ),
          SizedBox(width: fontSize * 0.02),
          Text('ard', style: base.copyWith(color: ink)),
        ],
      ),
    );
  }
}

class _BullseyePainter extends CustomPainter {
  _BullseyePainter({required this.ringColor, required this.dotColor});

  final Color ringColor;
  final Color dotColor;

  @override
  void paint(Canvas canvas, Size size) {
    final Offset center = Offset(size.width / 2, size.height / 2);
    final double outerR = size.width / 2;
    final double strokeW = size.width * 0.2;
    final double ringR = outerR - strokeW / 2;
    final double dotR = size.width * 0.14;

    final Paint ringPaint = Paint()
      ..color = ringColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeW
      ..isAntiAlias = true;
    canvas.drawCircle(center, ringR, ringPaint);

    final Paint dotPaint = Paint()
      ..color = dotColor
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;
    canvas.drawCircle(center, dotR, dotPaint);
  }

  @override
  bool shouldRepaint(covariant _BullseyePainter old) =>
      old.ringColor != ringColor || old.dotColor != dotColor;
}
