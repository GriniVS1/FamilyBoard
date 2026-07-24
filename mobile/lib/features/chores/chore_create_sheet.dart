import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/family_member.dart';
import '../../models/mutations.dart';
import '../../models/session.dart';
import '../../state/members_provider.dart';
import '../../state/session_provider.dart';
import '../../state/today_provider.dart';

/// A small, chore-relevant emoji set. Kept separate from the member-emoji set
/// in `member_edit_sheet.dart` — different purpose, different icons. Each is
/// a single codepoint or a short VS16 sequence, well under the route's
/// 8-character `icon` cap.
const List<String> _kChoreEmojis = <String>[
  '🧹',
  '🧺',
  '🍽️',
  '🛏️',
  '🗑️',
  '🧽',
  '📚',
  '🌱',
  '🐕',
  '🚗',
];

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
Future<void> showChoreCreateSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (BuildContext ctx) => const ChoreCreateSheet(),
  );
}

class ChoreCreateSheet extends ConsumerStatefulWidget {
  const ChoreCreateSheet({super.key});

  @override
  ConsumerState<ChoreCreateSheet> createState() => _ChoreCreateSheetState();
}

class _ChoreCreateSheetState extends ConsumerState<ChoreCreateSheet> {
  final TextEditingController _titleController = TextEditingController();
  String? _memberId;
  String? _emoji;
  int _points = 1;
  _ChoreRecurrence _recurrence = _ChoreRecurrence.none;
  bool _busy = false;

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
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
      await ref.read(mutationsServiceProvider).createChore(
            session: session,
            title: title,
            memberId: _memberId,
            icon: _emoji,
            points: _points,
            rrule: _recurrence.rrule,
          );
      if (!mounted) {
        return;
      }
      ref.invalidate(todayProvider);
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
        membersAsync.valueOrNull?.members ?? const <FamilyMember>[];

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
              decoration:
                  InputDecoration(labelText: l10n.calendarEventTitleLabel),
            ),
            const SizedBox(height: 8),
            Text(
              l10n.calendarEventMemberLabel,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String?>(
              initialValue: _memberId,
              isExpanded: true,
              items: <DropdownMenuItem<String?>>[
                DropdownMenuItem<String?>(
                  child: Text(l10n.choresMemberNone),
                ),
                ...members.map(
                  (FamilyMember m) => DropdownMenuItem<String?>(
                    value: m.id,
                    child: Text('${m.emoji} ${m.name}'.trim()),
                  ),
                ),
              ],
              onChanged:
                  _busy ? null : (String? id) => setState(() => _memberId = id),
            ),
            const SizedBox(height: 16),
            Text(
              l10n.membersEmojiLabel,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            _ChoreEmojiGrid(
              selected: _emoji,
              onChanged: _busy
                  ? null
                  : (String? e) => setState(
                        () => _emoji = e == _emoji ? null : e,
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

class _ChoreEmojiGrid extends StatelessWidget {
  const _ChoreEmojiGrid({required this.selected, required this.onChanged});

  final String? selected;
  final void Function(String)? onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _kChoreEmojis.map((String emoji) {
        final bool isSelected = emoji == selected;
        return GestureDetector(
          onTap: onChanged != null ? () => onChanged!(emoji) : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isSelected
                  ? Theme.of(context).colorScheme.primaryContainer
                  : Theme.of(context).colorScheme.surfaceContainerHighest,
              border: Border.all(
                color: isSelected
                    ? Theme.of(context).colorScheme.primary
                    : Colors.transparent,
                width: 2,
              ),
            ),
            child: Center(
              child: Text(emoji, style: const TextStyle(fontSize: 20)),
            ),
          ),
        );
      }).toList(),
    );
  }
}
