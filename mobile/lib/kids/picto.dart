/// Kids-UI pictogram (R3.1): the wall's static SVG for the current theme.
library;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'picto_catalog.g.dart';

/// Size presets in dp (R3.1, R4.2).
class KidPictoSize {
  const KidPictoSize._();

  /// Chip-row mini picto (R4.4, R4.6).
  static const double mini = 24;

  /// Bottom navigation.
  static const double nav = 32;

  /// Task or event card on the phone.
  static const double card = 48;

  /// Header, empty and error states: 80-120.
  static const double hero = 96;
  static const double heroLarge = 120;
}

class KidPicto extends StatelessWidget {
  const KidPicto(
    this.name, {
    this.size = KidPictoSize.card,
    this.semanticLabel,
    super.key,
  }) : assert(size > 0, 'size must be positive');

  /// Motif name, e.g. `water` or `nav-home` (see [kPictoCatalog]).
  final String name;
  final double size;

  /// Pictos next to text are decorative and excluded from semantics (R9.4).
  /// Pass a label only when the picto stands alone.
  final String? semanticLabel;

  static String assetPath(String name, Brightness brightness) =>
      'assets/kids/pictos/${brightness == Brightness.dark ? 'dark' : 'light'}'
      '/$name.svg';

  @override
  Widget build(BuildContext context) {
    assert(kPictoCatalog.containsKey(name), 'Unknown picto "$name"');
    final Brightness brightness = Theme.of(context).brightness;
    return SvgPicture.asset(
      assetPath(name, brightness),
      width: size,
      height: size,
      semanticsLabel: semanticLabel,
      excludeFromSemantics: semanticLabel == null,
      placeholderBuilder: (BuildContext _) => SizedBox.square(dimension: size),
    );
  }
}
