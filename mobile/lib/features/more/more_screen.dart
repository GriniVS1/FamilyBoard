import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../kids/kid_tap.dart';
import '../../kids/kid_theme.dart';
import '../../kids/picto.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../widgets/adaptive_layout.dart';
import '../../widgets/familyboard_logo.dart';

/// "Mehr" tab - the adult areas that do not get a bottom-tab slot (R7.2): To-dos,
/// Notizen, Fotos, Einkauf and Einstellungen. Each row pushes its target on the
/// root navigator (they are top-level routes in `app.dart`, outside the
/// bottom-tab shell), so the pushed screen covers the tab bar.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    return Scaffold(
      appBar: AppBar(title: const FamilyBoardLogo(fontSize: 18)),
      body: SafeArea(
        child: ConstrainedContent(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: <Widget>[
              _MoreRow(
                picto: 'nav-todos',
                accent: 'mint',
                label: l10n.navTodos,
                onTap: () => context.push('/todos'),
              ),
              const SizedBox(height: 12),
              _MoreRow(
                picto: 'nav-notes',
                accent: 'lilac',
                label: l10n.notesTitle,
                onTap: () => context.push('/notes'),
              ),
              const SizedBox(height: 12),
              _MoreRow(
                picto: 'nav-photos',
                accent: 'teal',
                label: l10n.photosTitle,
                onTap: () => context.push('/photos'),
              ),
              const SizedBox(height: 12),
              _MoreRow(
                picto: 'shopping',
                accent: 'peach',
                label: l10n.groceryTitle,
                onTap: () => context.push('/grocery'),
              ),
              const SizedBox(height: 12),
              _MoreRow(
                picto: 'nav-settings',
                accent: 'sand',
                label: l10n.settingsTitle,
                locked: true,
                onTap: () => context.push('/settings'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MoreRow extends StatelessWidget {
  const _MoreRow({
    required this.picto,
    required this.accent,
    required this.label,
    required this.onTap,
    this.locked = false,
  });

  final String picto;
  final String accent;
  final String label;
  final VoidCallback onTap;

  /// Shows the 🔒 badge: an adult area (Einstellungen).
  final bool locked;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final KidAccent colors = tokens.accent(accent);
    return KidTap(
      onTap: onTap,
      semanticLabel: label,
      builder: (BuildContext context, KidTapState tap) {
        return KidPressable(
          color: tokens.surface,
          pressed: tap.pressed,
          border: Border.all(color: tokens.border, width: 2),
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: <Widget>[
                SizedBox.square(
                  dimension: 56,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: <Widget>[
                      Positioned.fill(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: colors.tint,
                            borderRadius: KidRadius.pictoTileBorder,
                          ),
                          child: Center(child: KidPicto(picto, size: 40)),
                        ),
                      ),
                      if (locked)
                        Positioned(
                          right: -6,
                          bottom: -6,
                          child: Container(
                            width: 26,
                            height: 26,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: tokens.surface,
                              border: Border.all(
                                color: tokens.border,
                                width: 2,
                              ),
                            ),
                            child: Icon(
                              Icons.lock_rounded,
                              size: 16,
                              color: tokens.ink,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    label,
                    style: KidText.title.copyWith(color: tokens.ink),
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  size: 28,
                  color: tokens.muted,
                ),
                const SizedBox(width: 4),
              ],
            ),
          ),
        );
      },
    );
  }
}
