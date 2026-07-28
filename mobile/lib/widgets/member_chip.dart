import 'package:flutter/material.dart';

import '../theme.dart';

/// Small circular chip showing a member's emoji (or initial) in their accent
/// color. Used wherever a chore/todo row needs to show who it's assigned to
/// (Home cards, Tasks screen).
class MemberChip extends StatelessWidget {
  const MemberChip({
    super.key,
    required this.name,
    required this.color,
    required this.emoji,
  });

  final String name;

  /// One of the 8 accent names ("peach", "mint", …).
  final String color;
  final String emoji;

  @override
  Widget build(BuildContext context) {
    final Color accent = AccentPalette.resolve(color);
    final String label = emoji.isNotEmpty
        ? emoji
        : (name.isNotEmpty ? name[0].toUpperCase() : '?');
    return Tooltip(
      message: name,
      child: Container(
        width: 24,
        height: 24,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.25),
          shape: BoxShape.circle,
          border: Border.all(color: accent, width: 1.5),
        ),
        child: Text(label, style: const TextStyle(fontSize: 12)),
      ),
    );
  }
}

/// Neutral chip shown for an unassigned chore/todo — it stays open to (and
/// visible for) the whole family, so it gets a plain label rather than an
/// accent color that would wrongly imply a specific assignee.
class UnassignedChip extends StatelessWidget {
  const UnassignedChip({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final ColorScheme cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: cs.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: cs.outline),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: cs.onSurface.withValues(alpha: 0.6),
        ),
      ),
    );
  }
}
