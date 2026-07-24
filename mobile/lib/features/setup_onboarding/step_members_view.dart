import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../models/setup_member_draft.dart';
import '../../state/setup_onboarding_controller.dart';
import '../../theme.dart';
import 'setup_error_text.dart';

/// The wall's member-emoji set (`MEMBER_EMOJIS` in
/// `src/components/setup/types.ts`, out of mobile's edit scope — kept in
/// sync manually, same duplication as `member_edit_sheet.dart`).
const List<String> _kMemberEmojis = <String>[
  '👩',
  '👨',
  '👧',
  '👦',
  '🧑',
  '👵',
  '👴',
  '🐶',
  '🐱',
  '🦊',
  '🐻',
  '🦁',
];

/// All 8 accent names in the canonical order.
const List<String> _kAccentNames = <String>[
  'peach',
  'mint',
  'sun',
  'sky',
  'lilac',
  'rose',
  'teal',
  'sand',
];

const int _kMaxMembers = 8;

class _MemberDraftFields {
  _MemberDraftFields(
      {required String name, required this.color, required this.emoji})
      : nameController = TextEditingController(text: name);

  final TextEditingController nameController;
  String color;
  String emoji;

  SetupMemberDraft toDraft() => SetupMemberDraft(
        name: nameController.text,
        color: color,
        emoji: emoji,
      );

  void dispose() => nameController.dispose();
}

class StepMembersView extends ConsumerStatefulWidget {
  const StepMembersView({super.key});

  @override
  ConsumerState<StepMembersView> createState() => _StepMembersViewState();
}

class _StepMembersViewState extends ConsumerState<StepMembersView> {
  final List<_MemberDraftFields> _rows = <_MemberDraftFields>[];

  @override
  void initState() {
    super.initState();
    _addRow();
  }

  @override
  void dispose() {
    for (final _MemberDraftFields row in _rows) {
      row.dispose();
    }
    super.dispose();
  }

  void _addRow() {
    if (_rows.length >= _kMaxMembers) {
      return;
    }
    setState(() {
      _rows.add(
        _MemberDraftFields(
          name: '',
          color: _kAccentNames[_rows.length % _kAccentNames.length],
          emoji: _kMemberEmojis[_rows.length % _kMemberEmojis.length],
        ),
      );
    });
  }

  void _removeRow(int index) {
    if (_rows.length <= 1) {
      return;
    }
    setState(() {
      _rows.removeAt(index).dispose();
    });
  }

  Future<void> _next() async {
    final List<SetupMemberDraft> drafts = _rows
        .map((_MemberDraftFields r) => r.toDraft())
        .where((SetupMemberDraft d) => d.name.trim().isNotEmpty)
        .toList();
    if (drafts.isEmpty) {
      return;
    }
    await ref
        .read(setupOnboardingControllerProvider.notifier)
        .submitMembers(drafts);
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final SetupOnboardingState state =
        ref.watch(setupOnboardingControllerProvider);
    final bool hasAnyName = _rows
        .any((_MemberDraftFields r) => r.nameController.text.trim().isNotEmpty);

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(l10n.setupMembersTitle,
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 8),
          Text(l10n.setupMembersDescription,
              style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 24),
          for (int i = 0; i < _rows.length; i++) ...<Widget>[
            _MemberRow(
              fields: _rows[i],
              isAdmin: i == 0,
              onChanged: () => setState(() {}),
              onRemove: _rows.length > 1 ? () => _removeRow(i) : null,
              l10n: l10n,
            ),
            const SizedBox(height: 16),
          ],
          if (_rows.length < _kMaxMembers)
            OutlinedButton.icon(
              icon: const Icon(Icons.person_add_alt_outlined),
              label: Text(l10n.setupMembersAddButton),
              onPressed: _addRow,
            ),
          if (!hasAnyName) ...<Widget>[
            const SizedBox(height: 8),
            Text(
              l10n.setupMembersMinError,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: Theme.of(context).colorScheme.error),
            ),
          ],
          if (state.error != null) ...<Widget>[
            const SizedBox(height: 16),
            SetupErrorText(kind: state.error!),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: (!hasAnyName || state.submitting) ? null : _next,
            child: state.submitting
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  )
                : Text(l10n.setupStepNext),
          ),
        ],
      ),
    );
  }
}

class _MemberRow extends StatelessWidget {
  const _MemberRow({
    required this.fields,
    required this.isAdmin,
    required this.onChanged,
    required this.onRemove,
    required this.l10n,
  });

  final _MemberDraftFields fields;
  final bool isAdmin;
  final VoidCallback onChanged;
  final VoidCallback? onRemove;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: TextField(
                    controller: fields.nameController,
                    textCapitalization: TextCapitalization.words,
                    maxLength: 40,
                    onChanged: (String _) => onChanged(),
                    decoration: InputDecoration(
                      labelText: l10n.membersNameLabel,
                      counterText: '',
                    ),
                  ),
                ),
                if (isAdmin) ...<Widget>[
                  const SizedBox(width: 8),
                  Chip(label: Text(l10n.setupMembersAdminBadge)),
                ],
                if (onRemove != null)
                  IconButton(
                    icon: const Icon(Icons.close),
                    tooltip: l10n.setupMembersRemoveTooltip,
                    onPressed: onRemove,
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(l10n.membersEmojiLabel,
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _kMemberEmojis.map((String emoji) {
                final bool selected = emoji == fields.emoji;
                return GestureDetector(
                  onTap: () {
                    fields.emoji = emoji;
                    onChanged();
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: selected
                          ? Theme.of(context).colorScheme.primaryContainer
                          : Theme.of(context)
                              .colorScheme
                              .surfaceContainerHighest,
                      border: Border.all(
                        color: selected
                            ? Theme.of(context).colorScheme.primary
                            : Colors.transparent,
                        width: 2,
                      ),
                    ),
                    child: Center(
                        child:
                            Text(emoji, style: const TextStyle(fontSize: 20))),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 8),
            Text(l10n.membersColorLabel,
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _kAccentNames.map((String name) {
                final Color color = AccentPalette.resolve(name);
                final bool selected = name == fields.color;
                return GestureDetector(
                  onTap: () {
                    fields.color = name;
                    onChanged();
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: selected
                            ? Theme.of(context).colorScheme.onSurface
                            : Colors.transparent,
                        width: selected ? 3 : 0,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}
