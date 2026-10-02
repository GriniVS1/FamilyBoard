/// Row of avatars that switches whose board is shown (R6.1) or, on Heute,
/// filters the events to one person (R8.3).
library;

import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import 'kid_avatar.dart';
import 'kid_tap.dart';
import 'kid_theme.dart';

/// One person in the strip.
class KidStripPerson {
  const KidStripPerson({
    required this.id,
    required this.name,
    required this.color,
    required this.emoji,
    this.openCount,
    this.progress,
  });

  final String id;
  final String name;
  final String color;
  final String emoji;

  /// Open chores today. Null: no badge (events strip).
  final int? openCount;
  final ({int done, int total})? progress;
}

/// Sentinel id of the dashed "for everyone" entry.
const String kEveryoneId = '__everyone__';

/// Sentinel id of the "Alle" entry that clears a person filter (R8.3).
const String kAllId = '__all__';

class KidMemberStrip extends StatelessWidget {
  const KidMemberStrip({
    required this.people,
    required this.selectedId,
    required this.onSelect,
    this.everyoneOpenCount,
    this.everyoneLabel,
    this.allLabel,
    super.key,
  });

  final List<KidStripPerson> people;

  /// Highlighted entry: a person id, [kEveryoneId], or null for none.
  final String? selectedId;
  final void Function(String id) onSelect;

  /// Shows the dashed "for everyone" entry with this badge; null hides it.
  final int? everyoneOpenCount;
  final String? everyoneLabel;

  /// Adds a leading "Alle" entry (selected while [selectedId] is [kAllId]).
  final String? allLabel;

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    return SizedBox(
      height: 108,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        children: <Widget>[
          if (allLabel != null)
            _StripItem(
              selected: selectedId == kAllId,
              accent: 'sand',
              label: allLabel!,
              semanticLabel: allLabel!,
              onTap: () => onSelect(kAllId),
              avatar: const _AllAvatar(),
            ),
          for (final KidStripPerson p in people)
            _StripItem(
              selected: p.id == selectedId,
              accent: p.color,
              label: p.name,
              semanticLabel: p.openCount == null
                  ? p.name
                  : l10n.kidAvatarOpen(p.name, p.openCount!),
              onTap: () => onSelect(p.id),
              avatar: KidAvatar(
                name: p.name,
                color: p.color,
                emoji: p.emoji,
                progress: p.progress != null && p.progress!.total > 0
                    ? p.progress
                    : null,
                openCount: p.openCount,
              ),
            ),
          if (everyoneOpenCount != null)
            _StripItem(
              selected: selectedId == kEveryoneId,
              accent: 'sand',
              label: everyoneLabel ?? l10n.kidEveryone,
              semanticLabel: l10n.kidAvatarOpen(
                everyoneLabel ?? l10n.kidEveryone,
                everyoneOpenCount!,
              ),
              onTap: () => onSelect(kEveryoneId),
              avatar: _EveryoneAvatar(openCount: everyoneOpenCount!),
            ),
        ],
      ),
    );
  }
}

class _StripItem extends StatelessWidget {
  const _StripItem({
    required this.selected,
    required this.accent,
    required this.label,
    required this.semanticLabel,
    required this.onTap,
    required this.avatar,
  });

  final bool selected;
  final String accent;
  final String label;
  final String semanticLabel;
  final VoidCallback onTap;
  final Widget avatar;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final KidAccent colors = tokens.accent(accent);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: KidTap(
        onTap: onTap,
        semanticLabel: semanticLabel,
        checked: selected,
        borderRadius: BorderRadius.circular(24),
        builder: (BuildContext context, KidTapState tap) {
          return Container(
            width: 80,
            padding: const EdgeInsets.fromLTRB(4, 6, 4, 4),
            decoration: BoxDecoration(
              color: selected ? colors.tint : Colors.transparent,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: selected ? colors.base : Colors.transparent,
                width: 2,
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                avatar,
                const SizedBox(height: 4),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: KidText.label.copyWith(
                    color: selected ? colors.ink : tokens.ink,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _AllAvatar extends StatelessWidget {
  const _AllAvatar();

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    return Container(
      width: 56,
      height: 56,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: tokens.surface,
        border: Border.all(color: tokens.ink, width: 3),
      ),
      child: Icon(Icons.groups_rounded, size: 30, color: tokens.ink),
    );
  }
}

class _EveryoneAvatar extends StatelessWidget {
  const _EveryoneAvatar({required this.openCount});

  final int openCount;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    const double d = 56;
    return SizedBox.square(
      dimension: d,
      child: Stack(
        clipBehavior: Clip.none,
        children: <Widget>[
          Positioned.fill(
            child: CustomPaint(
              painter: _DashedCirclePainter(color: tokens.muted),
              child: Center(
                child: Icon(Icons.groups_rounded, size: 30, color: tokens.ink),
              ),
            ),
          ),
          Positioned(
            top: -2,
            right: -2,
            child: Container(
              constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: openCount == 0 ? tokens.success : tokens.ink,
                border: Border.all(color: tokens.surface, width: 2),
              ),
              child: openCount == 0
                  ? KidCheck(color: tokens.surface, size: 16)
                  : Text(
                      '$openCount',
                      style: KidText.label.copyWith(
                        color: tokens.bg,
                        fontSize: 13,
                        height: 1,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DashedCirclePainter extends CustomPainter {
  const _DashedCirclePainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final Path path = Path()..addOval((Offset.zero & size).deflate(1.5));
    final Paint paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..color = color;
    for (final metric in path.computeMetrics()) {
      double distance = 0;
      while (distance < metric.length) {
        canvas.drawPath(metric.extractPath(distance, distance + 7), paint);
        distance += 12;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedCirclePainter old) => old.color != color;
}
