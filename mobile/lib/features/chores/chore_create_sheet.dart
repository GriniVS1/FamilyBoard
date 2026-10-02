import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app.dart';
import '../../kids/kid_theme.dart';
import '../../kids/picto.dart';
import '../../kids/picto_catalog.g.dart';
import '../../kids/picto_resolver.dart';
import '../../kids/picto_suggest.dart';
import '../../kids/kid_group_widgets.dart';
import '../../kids/kid_tap.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/family_member.dart';
import '../../models/mutations.dart';
import '../../models/session.dart';
import '../../state/chores_provider.dart';
import '../../state/members_provider.dart';
import '../../state/session_provider.dart';

enum _ChoreRecurrence { none, daily, weekly }

extension on _ChoreRecurrence {
  /// Maps the segmented-control selection to the `rrule` sent to the wall.
  /// `none` intentionally maps to `null` so [buildCreateChorePayload] omits
  /// the key entirely rather than sending `rrule: null`.
  String? get rrule {
    switch (this) {
      case _ChoreRecurrence.none:
        return null;
      case _ChoreRecurrence.daily:
        return 'FREQ=DAILY';
      case _ChoreRecurrence.weekly:
        return 'FREQ=WEEKLY';
    }
  }
}

/// Opens [ChoreCreateSheet] as a modal bottom sheet. Admin-only — callers are
/// expected to have already gated the entry point (the "+" button on the
/// Ämtli card only renders for admins).
Future<void> showChoreCreateSheet(BuildContext context, {String? memberId}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (BuildContext ctx) => ChoreCreateSheet(initialMemberId: memberId),
  );
}

class ChoreCreateSheet extends ConsumerStatefulWidget {
  const ChoreCreateSheet({this.initialMemberId, super.key});

  /// Pre-selected assignee (the board the "+" was tapped on).
  final String? initialMemberId;

  @override
  ConsumerState<ChoreCreateSheet> createState() => _ChoreCreateSheetState();
}

class _ChoreCreateSheetState extends ConsumerState<ChoreCreateSheet> {
  final TextEditingController _titleController = TextEditingController();
  late String? _memberId = widget.initialMemberId;

  /// Picto the admin picked by hand; null while the title suggests one.
  String? _pickedPicto;
  int _points = 1;
  _ChoreRecurrence _recurrence = _ChoreRecurrence.none;
  bool _busy = false;

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  /// The picto shown as selected: the hand-picked one, else what the title
  /// suggests.
  String? get _picto {
    final String? picked = _pickedPicto;
    if (picked != null) {
      return picked.isEmpty ? null : picked;
    }
    return suggestPicto(_titleController.text.trim());
  }

  void _showError(String message) {
    scaffoldMessengerKey.currentState?.showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  Future<void> _submit() async {
    final String title = _titleController.text.trim();
    if (title.isEmpty || _busy) {
      return;
    }
    final SessionState sessionState = ref.read(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return;
    }

    setState(() => _busy = true);
    final AppL10n l10n = AppL10n.of(context);

    try {
      await ref
          .read(mutationsServiceProvider)
          .createChore(
            session: session,
            title: title,
            memberId: _memberId,
            // R3.3: the canonical emoji of the motif, never its name, so the
            // wall and older clients keep working.
            icon: _picto == null ? null : canonicalEmojiFor(_picto!),
            points: _points,
            rrule: _recurrence.rrule,
          );
      if (!mounted) {
        return;
      }
      ref.invalidate(choresProvider);
      Navigator.of(context).pop();
    } on MutationSessionRevokedException {
      if (!mounted) {
        return;
      }
      await ref.read(sessionProvider.notifier).clear();
    } on MutationNotAdminException {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      _showError(l10n.choresErrorNotAdmin);
    } on MutationFetchException {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      _showError(l10n.choresCreateErrorGeneric);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final AsyncValue<MembersResult> membersAsync = ref.watch(membersProvider);
    final List<FamilyMember> members =
        membersAsync.value?.members ?? const <FamilyMember>[];

    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              l10n.choresCreateTitle,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _titleController,
              autofocus: true,
              maxLength: 100,
              textCapitalization: TextCapitalization.sentences,
              onChanged: (String _) => setState(() {}),
              decoration: InputDecoration(
                labelText: l10n.calendarEventTitleLabel,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              l10n.calendarEventMemberLabel,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String?>(
              // Rebuilt once the members have loaded, so a pre-selected
              // assignee is found among the items.
              key: ValueKey<int>(members.length),
              initialValue: members.any((FamilyMember m) => m.id == _memberId)
                  ? _memberId
                  : null,
              isExpanded: true,
              items: <DropdownMenuItem<String?>>[
                DropdownMenuItem<String?>(child: Text(l10n.choresMemberNone)),
                ...members.map(
                  (FamilyMember m) => DropdownMenuItem<String?>(
                    value: m.id,
                    child: Text('${m.emoji} ${m.name}'.trim()),
                  ),
                ),
              ],
              onChanged: _busy
                  ? null
                  : (String? id) => setState(() => _memberId = id),
            ),
            const SizedBox(height: 16),
            Text(
              l10n.kidPickPicture,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            _ChorePictoGrid(
              selected: _picto,
              onChanged: _busy
                  ? null
                  : (String name) => setState(
                      () => _pickedPicto = name == _picto ? '' : name,
                    ),
            ),
            const SizedBox(height: 16),
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    l10n.choresStarsLabel,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Text(
                  l10n.homePointsLabel(_points),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            Slider(
              value: _points.toDouble(),
              min: 1,
              max: 50,
              divisions: 49,
              label: '$_points',
              onChanged: _busy
                  ? null
                  : (double v) => setState(() => _points = v.round()),
            ),
            const SizedBox(height: 8),
            Text(
              l10n.calendarEventRecurrenceLabel,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            SegmentedButton<_ChoreRecurrence>(
              segments: <ButtonSegment<_ChoreRecurrence>>[
                ButtonSegment<_ChoreRecurrence>(
                  value: _ChoreRecurrence.none,
                  label: Text(l10n.choresRecurrenceNone),
                ),
                ButtonSegment<_ChoreRecurrence>(
                  value: _ChoreRecurrence.daily,
                  label: Text(l10n.calendarEventRecurrenceDaily),
                ),
                ButtonSegment<_ChoreRecurrence>(
                  value: _ChoreRecurrence.weekly,
                  label: Text(l10n.calendarEventRecurrenceWeekly),
                ),
              ],
              selected: <_ChoreRecurrence>{_recurrence},
              onSelectionChanged: _busy
                  ? null
                  : (Set<_ChoreRecurrence> sel) =>
                        setState(() => _recurrence = sel.first),
            ),
            const SizedBox(height: 20),
            Row(
              children: <Widget>[
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : () => Navigator.of(context).pop(),
                    child: Text(
                      MaterialLocalizations.of(context).cancelButtonLabel,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: (_busy || _titleController.text.trim().isEmpty)
                        ? null
                        : _submit,
                    child: _busy
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(l10n.choresCreateSubmit),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Picture picker (R3.3): the task motifs of the wall instead of an emoji
/// grid. Tapping the selected motif clears it.
class _ChorePictoGrid extends StatelessWidget {
  const _ChorePictoGrid({required this.selected, required this.onChanged});

  final String? selected;
  final void Function(String name)? onChanged;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    return Wrap(
      spacing: KidTouch.gap,
      runSpacing: KidTouch.gap,
      children: <Widget>[
        for (final PictoMeta meta in pictosOfCategory(PictoCategory.task))
          KidTap(
            onTap: onChanged == null ? null : () => onChanged!(meta.name),
            semanticLabel: pictoLabel(context, meta.name),
            checked: meta.name == selected,
            borderRadius: KidRadius.pictoTileBorder,
            builder: (BuildContext context, KidTapState tap) {
              final bool isSelected = meta.name == selected;
              return Container(
                width: 56,
                height: 56,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: isSelected ? tokens.accentSunTint : tokens.surface,
                  borderRadius: KidRadius.pictoTileBorder,
                  border: Border.all(
                    color: isSelected ? tokens.ink : tokens.border,
                    width: isSelected ? 3 : 2,
                  ),
                ),
                child: KidPicto(meta.name, size: 40),
              );
            },
          ),
      ],
    );
  }
}
