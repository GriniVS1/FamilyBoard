import 'package:flutter/material.dart';

import '../kids/kid_theme.dart';
import '../kids/picto.dart';
import '../l10n/generated/app_localizations.dart';

/// One destination of the tab shell (R7.1): picto and area colour. Inactive
/// shows the picto only, active adds a tint pill and the label.
class KidNavDestinationSpec {
  const KidNavDestinationSpec({
    required this.picto,
    required this.accent,
    required this.label,
  });

  final String picto;

  /// Area colour; null for "Mehr", which stays neutral.
  final String? accent;
  final String label;
}

/// Order matches `tab_index.dart`: Heute, Aufgaben, Kalender, Essen, Mehr.
List<KidNavDestinationSpec> kidNavDestinations(
  AppL10n l10n,
) => <KidNavDestinationSpec>[
  KidNavDestinationSpec(
    picto: 'nav-home',
    accent: 'rose',
    label: l10n.navToday,
  ),
  KidNavDestinationSpec(
    picto: 'nav-tasks',
    accent: 'sun',
    label: l10n.navTasks,
  ),
  KidNavDestinationSpec(
    picto: 'nav-calendar',
    accent: 'sky',
    label: l10n.navCalendar,
  ),
  KidNavDestinationSpec(
    picto: 'nav-meals',
    accent: 'peach',
    label: l10n.navMeals,
  ),
  KidNavDestinationSpec(picto: 'nav-more', accent: null, label: l10n.navMore),
];

/// Inactive icon: the picto alone.
class KidNavIcon extends StatelessWidget {
  const KidNavIcon({required this.spec, super.key});

  final KidNavDestinationSpec spec;

  @override
  Widget build(BuildContext context) {
    return KidPicto(spec.picto, size: KidPictoSize.nav);
  }
}

/// Active icon: the picto on a pill in the area's tint.
class KidNavPill extends StatelessWidget {
  const KidNavPill({required this.spec, super.key});

  final KidNavDestinationSpec spec;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final Color tint = spec.accent == null
        ? tokens.border
        : tokens.accent(spec.accent).tint;
    return Container(
      width: 64,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: tint,
        borderRadius: BorderRadius.circular(20),
      ),
      child: KidPicto(spec.picto, size: KidPictoSize.nav),
    );
  }
}
