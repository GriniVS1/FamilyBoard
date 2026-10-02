/// Kids-UI foundation: type scale (R2.1), radii (R2.3), touch sizes (R2.4)
/// and the "pressable" elevation treatment. Colours live in [KidTokens]
/// (generated from the wall's `tokens.json`) and are read via `context.kid`.
library;

import 'package:flutter/material.dart';

import 'kid_tokens.g.dart';

export 'kid_tokens.g.dart';

extension KidThemeContext on BuildContext {
  /// The wall's design tokens for the current brightness (R1.1).
  KidTokens get kid => Theme.of(this).extension<KidTokens>()!;
}

/// Kid type scale. No font family is set: the app ships no custom fonts and
/// R2.1 forbids adding new ones, so these inherit the platform UI font
/// (SF Pro / Roboto). The wall's Geist (titles) and Inter (body) are not
/// bundled in `mobile/`; swapping them in later only touches this class.
///
/// Colour is intentionally absent so the styles inherit from the surrounding
/// [DefaultTextStyle] (ink on surface, `on-accent` on a done card).
class KidText {
  const KidText._();

  static const TextStyle label = TextStyle(
    fontSize: 14,
    height: 20 / 14,
    fontWeight: FontWeight.w600,
  );

  static const TextStyle body = TextStyle(
    fontSize: 16,
    height: 24 / 16,
    fontWeight: FontWeight.w500,
  );

  static const TextStyle title = TextStyle(
    fontSize: 18,
    height: 24 / 18,
    fontWeight: FontWeight.w600,
  );

  static const TextStyle titleLg = TextStyle(
    fontSize: 20,
    height: 28 / 20,
    fontWeight: FontWeight.w600,
  );

  static const TextStyle heading = TextStyle(
    fontSize: 28,
    height: 36 / 28,
    fontWeight: FontWeight.w600,
  );

  /// Counters and points: bold, tabular figures, tight leading.
  static const TextStyle number = TextStyle(
    fontSize: 24,
    height: 1,
    fontWeight: FontWeight.w700,
    fontFeatures: <FontFeature>[FontFeature.tabularFigures()],
  );

  /// Task titles wrap to at most two lines and are never ellipsised down to
  /// one word (R2.2); long words may break.
  static const int taskTitleMaxLines = 2;
}

/// Corner radii (R2.3). Buttons, chips and avatars are fully round.
class KidRadius {
  const KidRadius._();

  static const double group = 32;
  static const double card = 24;
  static const double pictoTile = 16;

  static const BorderRadius groupBorder = BorderRadius.all(
    Radius.circular(group),
  );
  static const BorderRadius cardBorder = BorderRadius.all(
    Radius.circular(card),
  );
  static const BorderRadius pictoTileBorder = BorderRadius.all(
    Radius.circular(pictoTile),
  );
}

/// Touch target sizes in dp (R2.4).
class KidTouch {
  const KidTouch._();

  static const double min = 48;
  static const double primary = 64;
  static const double gap = 8;
}

/// Edge of a raised card: 2 px ledge plus a soft drop shadow.
const double kKidPressDepth = 2;

/// The "pressable" treatment of the wall (`shadow-pop` / `shadow-press`).
class KidElevation {
  const KidElevation._();

  /// Resting state: a crisp 2 px ledge and a soft shadow.
  static List<BoxShadow> pop(KidTokens tokens) => <BoxShadow>[
    BoxShadow(
      offset: const Offset(0, kKidPressDepth),
      color: tokens.shadow.withValues(alpha: 0.08),
    ),
    BoxShadow(
      offset: const Offset(0, 8),
      blurRadius: 20,
      spreadRadius: -8,
      color: tokens.shadow.withValues(alpha: 0.22),
    ),
  ];

  /// Resting decoration for a raised card or tile.
  static BoxDecoration pressable(
    KidTokens tokens, {
    required Color color,
    BorderRadius borderRadius = KidRadius.cardBorder,
    Border? border,
  }) => BoxDecoration(
    color: color,
    borderRadius: borderRadius,
    border: border,
    boxShadow: pop(tokens),
  );

  /// Pressed decoration: outer shadows dropped. Pair with [KidPressable] for
  /// the 2 px nudge and the inner top edge.
  static BoxDecoration pressed(
    KidTokens tokens, {
    required Color color,
    BorderRadius borderRadius = KidRadius.cardBorder,
    Border? border,
  }) => BoxDecoration(color: color, borderRadius: borderRadius, border: border);
}

/// Surface with the pressable treatment. Pure presentation: the caller owns
/// the gesture and passes [pressed]. Flutter has no inset shadows, so the
/// pressed state paints the inner top edge as a 2 px band instead.
class KidPressable extends StatelessWidget {
  const KidPressable({
    required this.child,
    required this.color,
    this.pressed = false,
    this.borderRadius = KidRadius.cardBorder,
    this.border,
    super.key,
  });

  final Widget child;
  final Color color;
  final bool pressed;
  final BorderRadius borderRadius;
  final Border? border;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    if (!pressed) {
      return DecoratedBox(
        decoration: KidElevation.pressable(
          tokens,
          color: color,
          borderRadius: borderRadius,
          border: border,
        ),
        child: child,
      );
    }
    return Transform.translate(
      offset: const Offset(0, kKidPressDepth),
      child: DecoratedBox(
        decoration: KidElevation.pressed(
          tokens,
          color: color,
          borderRadius: borderRadius,
          border: border,
        ),
        child: ClipRRect(
          borderRadius: borderRadius,
          child: Stack(
            children: <Widget>[
              child,
              Positioned(
                left: 0,
                right: 0,
                top: 0,
                height: kKidPressDepth,
                child: IgnorePointer(
                  child: ColoredBox(
                    color: tokens.shadow.withValues(alpha: 0.10),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
