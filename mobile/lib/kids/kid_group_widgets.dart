/// Group chrome of the chore board (R4.4-R4.6): the day-phase header with its
/// progress bar, the collapsed chip row, the ✓-strip and the column state
/// panels (celebrate / night / pause / empty).
library;

import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../models/chore.dart';
import 'chore_state.dart';
import 'kid_avatar.dart';
import 'kid_chore_card.dart';
import 'kid_tap.dart';
import 'kid_theme.dart';
import 'picto.dart';
import 'picto_catalog.g.dart';
import 'time_of_day.dart';

/// Picto of a day-phase group.
String groupPictoName(PhaseGroupKey key) => switch (key) {
  PhaseGroupKey.morning => 'tod-morning',
  PhaseGroupKey.day => 'tod-day',
  PhaseGroupKey.evening => 'tod-evening',
  PhaseGroupKey.anytime => 'tod-anytime',
};

/// The group that is running right now; none during the night.
PhaseGroupKey? groupKeyOfPhase(DayPhase phase) => switch (phase) {
  DayPhase.morning => PhaseGroupKey.morning,
  DayPhase.day => PhaseGroupKey.day,
  DayPhase.evening => PhaseGroupKey.evening,
  DayPhase.night => null,
};

/// Picto label from the wall's manifest, in the app language.
String pictoLabel(BuildContext context, String name) {
  final Map<String, String>? labels = kPictoCatalog[name]?.labels;
  if (labels == null) {
    return name;
  }
  final String lang = Localizations.localeOf(context).languageCode;
  return labels[lang] ?? labels['en'] ?? name;
}

const int _kMaxSegments = 12;
const double _kBarWidth = 56;
const double _kSegmentGap = 2;
const double _kOutlineMinWidth = 6;

/// One segment per chore, at most 12 in a fixed 56 dp, no digits (R4.4).
/// Done = solid in the person's colour, open = an outline; segments too thin
/// for an outline are tall when done and short when open, so the difference
/// is a shape and not only a colour.
class KidSegmentBar extends StatelessWidget {
  const KidSegmentBar({
    required this.done,
    required this.total,
    required this.accentName,
    super.key,
  });

  final int done;
  final int total;
  final String accentName;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final KidAccent accent = tokens.accent(accentName);
    final int count = total.clamp(1, _kMaxSegments);
    final int filled = total > _kMaxSegments
        ? (done / total * _kMaxSegments).round()
        : done;
    final double width = ((_kBarWidth - (count - 1) * _kSegmentGap) / count)
        .floorToDouble()
        .clamp(1, 14);
    final bool outlined = width >= _kOutlineMinWidth;
    return ExcludeSemantics(
      child: SizedBox(
        height: 14,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            for (int i = 0; i < count; i++) ...<Widget>[
              if (i > 0) const SizedBox(width: _kSegmentGap),
              if (i < filled)
                Container(
                  width: width,
                  height: 14,
                  decoration: BoxDecoration(
                    color: accent.base,
                    borderRadius: BorderRadius.circular(4),
                  ),
                )
              else if (outlined)
                Container(
                  width: width,
                  height: 14,
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: tokens.muted.withValues(alpha: 0.7),
                      width: 2,
                    ),
                    borderRadius: BorderRadius.circular(4),
                  ),
                )
              else
                Container(
                  width: width,
                  height: 6,
                  decoration: BoxDecoration(
                    color: tokens.muted.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Header of an open group: phase picto, name, progress segments, collapse.
class KidGroupHeader extends StatelessWidget {
  const KidGroupHeader({
    required this.group,
    required this.done,
    required this.total,
    required this.accentName,
    required this.current,
    required this.onToggle,
    super.key,
  });

  final PhaseGroupKey group;
  final int done;
  final int total;
  final String accentName;

  /// This is the phase running right now.
  final bool current;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final AppL10n l10n = AppL10n.of(context);
    final String name = pictoLabel(context, groupPictoName(group));
    final bool complete = total > 0 && done == total;
    return KidTap(
      onTap: onToggle,
      semanticLabel: l10n.kidGroupCollapse(name),
      semanticValue: l10n.kidGroupProgress(done, total),
      borderRadius: BorderRadius.circular(16),
      builder: (BuildContext context, KidTapState tap) {
        return SizedBox(
          height: 56,
          child: Row(
            children: <Widget>[
              const SizedBox(width: 4),
              KidPicto(groupPictoName(group), size: 40),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: KidText.title.copyWith(color: tokens.ink),
                ),
              ),
              Container(
                height: 32,
                constraints: const BoxConstraints(minWidth: 40),
                padding: const EdgeInsets.symmetric(horizontal: 8),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: current
                      ? tokens.surface
                      : tokens.surface.withValues(alpha: 0.7),
                ),
                child: complete
                    ? const KidPicto('celebrate', size: 24)
                    : KidSegmentBar(
                        done: done,
                        total: total,
                        accentName: accentName,
                      ),
              ),
              const SizedBox(width: 8),
              Icon(Icons.expand_less_rounded, size: 28, color: tokens.muted),
            ],
          ),
        );
      },
    );
  }
}

/// Collapsed group: mini pictos with ○ / ✓, one tap opens it (R4.4).
class KidGroupChips extends StatelessWidget {
  const KidGroupChips({
    required this.group,
    required this.chores,
    required this.isDone,
    required this.accentName,
    required this.onToggle,
    super.key,
  });

  final PhaseGroupKey group;
  final List<Chore> chores;
  final bool Function(Chore chore) isDone;
  final String accentName;
  final VoidCallback onToggle;

  static const double _chip = 40;
  static const double _gap = 6;
  static const int _maxChips = 5;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final AppL10n l10n = AppL10n.of(context);
    final String name = pictoLabel(context, groupPictoName(group));
    final int done = chores.where(isDone).length;
    return KidTap(
      onTap: onToggle,
      semanticLabel: l10n.kidGroupExpand(name),
      semanticValue: l10n.kidGroupProgress(done, chores.length),
      borderRadius: BorderRadius.circular(16),
      builder: (BuildContext context, KidTapState tap) {
        return Container(
          height: 56,
          padding: const EdgeInsets.symmetric(horizontal: 8),
          decoration: BoxDecoration(
            color: tokens.surface.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(16),
          ),
          child: LayoutBuilder(
            builder: (BuildContext context, BoxConstraints box) {
              const double chrome = 36 + 8 + 8 + 28;
              final int room = ((box.maxWidth - chrome + _gap) / (_chip + _gap))
                  .floor()
                  .clamp(1, _maxChips);
              final bool fits = chores.length <= room;
              final int shownCount = fits
                  ? chores.length
                  : (room - 1).clamp(1, _maxChips);
              final List<Chore> shown = chores.take(shownCount).toList();
              final int hidden = chores.length - shown.length;
              return Row(
                children: <Widget>[
                  KidPicto(groupPictoName(group), size: 36),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ExcludeSemantics(
                      child: Row(
                        children: <Widget>[
                          for (final Chore chore in shown)
                            Padding(
                              padding: const EdgeInsets.only(right: _gap),
                              child: _Chip(
                                chore: chore,
                                accentName: accentName,
                                done: isDone(chore),
                              ),
                            ),
                          if (hidden > 0)
                            Text(
                              '+$hidden',
                              style: KidText.label.copyWith(
                                color: tokens.muted,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  Icon(
                    Icons.expand_more_rounded,
                    size: 28,
                    color: tokens.muted,
                  ),
                ],
              );
            },
          ),
        );
      },
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.chore,
    required this.accentName,
    required this.done,
  });

  final Chore chore;
  final String accentName;
  final bool done;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    return SizedBox.square(
      dimension: KidGroupChips._chip,
      child: Stack(
        clipBehavior: Clip.none,
        children: <Widget>[
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: tokens.surface,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: KidTaskPicto(
                  chore: chore,
                  accentName: accentName,
                  size: 28,
                ),
              ),
            ),
          ),
          Positioned(
            right: -6,
            bottom: -6,
            child: Container(
              width: 18,
              height: 18,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: done ? tokens.success : tokens.surface,
                border: Border.all(
                  color: done ? tokens.success : tokens.muted,
                  width: 2,
                ),
              ),
              child: done ? KidCheck(color: tokens.surface, size: 12) : null,
            ),
          ),
        ],
      ),
    );
  }
}

/// The column state above the groups (R4.5): celebrate, night, pause, empty.
class KidStatePanel extends StatelessWidget {
  const KidStatePanel({required this.state, required this.upcoming, super.key});

  final ColumnState state;
  final ChoreTimeOfDay? upcoming;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final AppL10n l10n = AppL10n.of(context);
    final (String picto, String label, bool dim) = switch (state) {
      ColumnState.allDone => ('celebrate', l10n.kidStateAllDone, false),
      ColumnState.night => ('tod-night', l10n.kidStateNight, false),
      ColumnState.pause => (
        switch (upcoming) {
          ChoreTimeOfDay.morning => 'tod-morning',
          ChoreTimeOfDay.day => 'tod-day',
          ChoreTimeOfDay.evening => 'tod-evening',
          null => 'tod-anytime',
        },
        l10n.kidStatePause,
        true,
      ),
      ColumnState.empty => ('relax', l10n.kidNoChores, false),
      ColumnState.active => ('', '', false),
    };
    if (state == ColumnState.active) {
      return const SizedBox.shrink();
    }
    return Semantics(
      container: true,
      label: label,
      child: ExcludeSemantics(
        child: Container(
          constraints: const BoxConstraints(minHeight: 88),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: tokens.surface.withValues(alpha: 0.7),
            borderRadius: KidRadius.cardBorder,
          ),
          child: Row(
            children: <Widget>[
              Stack(
                clipBehavior: Clip.none,
                children: <Widget>[
                  Opacity(
                    opacity: dim ? 0.55 : 1,
                    child: KidPicto(picto, size: 72),
                  ),
                  if (state == ColumnState.pause)
                    Positioned(
                      right: -8,
                      bottom: -4,
                      child: Container(
                        width: 36,
                        height: 36,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: tokens.surface,
                          boxShadow: KidElevation.pop(tokens),
                        ),
                        child: const KidPicto('pause', size: 28),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Text(
                  label,
                  style: KidText.title.copyWith(color: tokens.ink),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// ✓-strip of mini pictos at the end of a group (R4.6).
class KidDoneStrip extends StatelessWidget {
  const KidDoneStrip({
    required this.chores,
    required this.isDone,
    required this.accentName,
    required this.onPress,
    this.interactive = true,
    super.key,
  });

  final List<Chore> chores;
  final bool Function(Chore chore) isDone;
  final String accentName;
  final bool Function(Chore chore, Offset center) onPress;
  final bool interactive;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: tokens.surface.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Wrap(
        spacing: KidTouch.gap,
        runSpacing: KidTouch.gap,
        children: <Widget>[
          for (final Chore chore in chores)
            KidDoneMini(
              key: ValueKey<String>('mini-${chore.id}'),
              chore: chore,
              accentName: accentName,
              done: isDone(chore),
              interactive: interactive,
              onPress: (Offset center) => onPress(chore, center),
            ),
        ],
      ),
    );
  }
}
