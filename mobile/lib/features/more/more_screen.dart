import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../widgets/familyboard_logo.dart';

/// "Mehr" tab — a plain navigation list to the screens that don't get their
/// own bottom-tab slot: Notes, Photos, Settings. Each row pushes its target
/// on the root navigator (they're top-level routes in `app.dart`, outside
/// the bottom-tab shell), so the pushed screen covers the tab bar.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    return Scaffold(
      appBar: AppBar(title: const FamilyBoardLogo(fontSize: 18)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: <Widget>[
            _MoreRow(
              icon: Icons.checklist_outlined,
              label: l10n.tasksTitle,
              onTap: () => context.push('/tasks'),
            ),
            const SizedBox(height: 12),
            _MoreRow(
              icon: Icons.sticky_note_2_outlined,
              label: l10n.notesTitle,
              onTap: () => context.push('/notes'),
            ),
            const SizedBox(height: 12),
            _MoreRow(
              icon: Icons.photo_library_outlined,
              label: l10n.photosTitle,
              onTap: () => context.push('/photos'),
            ),
            const SizedBox(height: 12),
            _MoreRow(
              icon: Icons.settings_outlined,
              label: l10n.settingsTitle,
              onTap: () => context.push('/settings'),
            ),
          ],
        ),
      ),
    );
  }
}

class _MoreRow extends StatelessWidget {
  const _MoreRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 52),
            child: Row(
              children: <Widget>[
                Icon(icon, color: Theme.of(context).colorScheme.onSurface),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    label,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Icon(
                  Icons.chevron_right,
                  color: Theme.of(
                    context,
                  ).colorScheme.onSurface.withValues(alpha: 0.4),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
