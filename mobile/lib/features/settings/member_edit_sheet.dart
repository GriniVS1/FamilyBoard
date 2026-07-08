import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/family_member.dart';
import '../../models/session.dart';
import '../../services/members_service.dart';
import '../../state/members_provider.dart';
import '../../state/session_provider.dart';
import '../../theme.dart';

/// The wall's member-emoji set (`MEMBER_EMOJIS` in
/// `src/components/setup/types.ts`, out of mobile's edit scope — kept in
/// sync manually).
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

/// Opens [MemberEditSheet] as a modal bottom sheet.
///
/// Pass [member] to pre-populate for edit mode; omit (null) for create mode.
Future<void> showMemberEditSheet(BuildContext context, {FamilyMember? member}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (BuildContext ctx) => MemberEditSheet(member: member),
  );
}

class MemberEditSheet extends ConsumerStatefulWidget {
  const MemberEditSheet({super.key, this.member});

  final FamilyMember? member;

  @override
  ConsumerState<MemberEditSheet> createState() => _MemberEditSheetState();
}

class _MemberEditSheetState extends ConsumerState<MemberEditSheet> {
  late final TextEditingController _nameController;
  late String _emoji;
  late String _color;
  late MemberRole _role;
  bool _busy = false;

  bool get _isEdit => widget.member != null;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.member?.name ?? '');
    _emoji = widget.member?.emoji ?? _kMemberEmojis.first;
    _color = widget.member?.color ?? _kAccentNames.first;
    _role = widget.member?.role ?? MemberRole.member;
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  void _showError(String message) {
    scaffoldMessengerKey.currentState?.showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  Future<void> _save() async {
    final String name = _nameController.text.trim();
    if (name.isEmpty || _busy) {
      return;
    }
    final SessionState sessionState = ref.read(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return;
    }

    setState(() => _busy = true);
    final AppL10n l10n = AppL10n.of(context);
    final MembersService service = ref.read(membersServiceProvider);

    try {
      if (_isEdit) {
        await service.updateMember(
          session: session,
          id: widget.member!.id,
          name: name,
          color: _color,
          emoji: _emoji,
          role: _role,
        );
      } else {
        await service.createMember(
          session: session,
          name: name,
          color: _color,
          emoji: _emoji,
          role: _role,
        );
      }
      if (!mounted) {
        return;
      }
      ref.invalidate(membersProvider);
      Navigator.of(context).pop();
    } on MembersSessionRevokedException {
      if (!mounted) {
        return;
      }
      await ref.read(sessionProvider.notifier).clear();
    } on MembersNotAdminException {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      _showError(l10n.membersErrorNotAdmin);
    } on MembersLastAdminException {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      _showError(l10n.membersErrorLastAdmin);
    } on MembersCapReachedException {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      _showError(l10n.membersErrorTooMany);
    } on MembersNotFoundException {
      if (!mounted) {
        return;
      }
      ref.invalidate(membersProvider);
      Navigator.of(context).pop();
    } on MembersFetchException {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      _showError(l10n.membersErrorGeneric);
    }
  }

  Future<void> _delete() async {
    final AppL10n l10n = AppL10n.of(context);
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        content: Text(l10n.membersDeleteConfirm(widget.member!.name)),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.membersDelete),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) {
      return;
    }

    final SessionState sessionState = ref.read(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(membersServiceProvider).deleteMember(
            session: session,
            id: widget.member!.id,
          );
      if (!mounted) {
        return;
      }
      ref.invalidate(membersProvider);
      Navigator.of(context).pop();
    } on MembersSessionRevokedException {
      if (!mounted) {
        return;
      }
      await ref.read(sessionProvider.notifier).clear();
    } on MembersNotAdminException {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      _showError(l10n.membersErrorNotAdmin);
    } on MembersLastAdminException {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      _showError(l10n.membersErrorLastAdmin);
    } on MembersLastMemberException {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      _showError(l10n.membersErrorLastMember);
    } on MembersNotFoundException {
      if (!mounted) {
        return;
      }
      ref.invalidate(membersProvider);
      Navigator.of(context).pop();
    } on MembersFetchException {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      _showError(l10n.membersErrorGeneric);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
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
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    _isEdit ? l10n.membersEditTitle : l10n.membersAddTitle,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                ),
                if (_isEdit)
                  IconButton(
                    icon: const Icon(Icons.delete_outline),
                    tooltip: l10n.membersDelete,
                    onPressed: _busy ? null : _delete,
                  ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _nameController,
              autofocus: !_isEdit,
              textCapitalization: TextCapitalization.words,
              onChanged: (String _) => setState(() {}),
              decoration: InputDecoration(labelText: l10n.membersNameLabel),
            ),
            const SizedBox(height: 16),
            Text(
              l10n.membersEmojiLabel,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            _EmojiGrid(
              selected: _emoji,
              onChanged:
                  _busy ? null : (String e) => setState(() => _emoji = e),
            ),
            const SizedBox(height: 16),
            Text(
              l10n.membersColorLabel,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            _ColorRow(
              selected: _color,
              onChanged:
                  _busy ? null : (String c) => setState(() => _color = c),
            ),
            const SizedBox(height: 16),
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    l10n.membersRoleLabel,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ),
                SegmentedButton<MemberRole>(
                  segments: <ButtonSegment<MemberRole>>[
                    ButtonSegment<MemberRole>(
                      value: MemberRole.member,
                      label: Text(l10n.membersRoleMemberOption),
                    ),
                    ButtonSegment<MemberRole>(
                      value: MemberRole.admin,
                      label: Text(l10n.membersRoleAdminOption),
                    ),
                  ],
                  selected: <MemberRole>{_role},
                  onSelectionChanged: _busy
                      ? null
                      : (Set<MemberRole> sel) =>
                          setState(() => _role = sel.first),
                ),
              ],
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
                    onPressed: (_busy || _nameController.text.trim().isEmpty)
                        ? null
                        : _save,
                    child: _busy
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(l10n.membersSave),
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

class _EmojiGrid extends StatelessWidget {
  const _EmojiGrid({required this.selected, required this.onChanged});

  final String selected;
  final void Function(String)? onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _kMemberEmojis.map((String emoji) {
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

class _ColorRow extends StatelessWidget {
  const _ColorRow({required this.selected, required this.onChanged});

  final String selected;
  final void Function(String)? onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _kAccentNames.map((String name) {
        final Color color = AccentPalette.resolve(name);
        final bool isSelected = name == selected;
        return GestureDetector(
          onTap: onChanged != null ? () => onChanged!(name) : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: Border.all(
                color: isSelected
                    ? Theme.of(context).colorScheme.onSurface
                    : Colors.transparent,
                width: isSelected ? 3 : 0,
              ),
              boxShadow: isSelected
                  ? <BoxShadow>[
                      BoxShadow(
                        color: color.withValues(alpha: 0.5),
                        blurRadius: 6,
                        spreadRadius: 1,
                      ),
                    ]
                  : null,
            ),
          ),
        );
      }).toList(),
    );
  }
}
