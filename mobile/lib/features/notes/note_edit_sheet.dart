import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/note.dart';
import '../../models/session.dart';
import '../../services/notes_service.dart';
import '../../state/notes_provider.dart';
import '../../state/session_provider.dart';
import '../../theme.dart';

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

/// Opens [NoteEditSheet] as a modal bottom sheet.
///
/// Pass [note] to pre-populate for edit mode; omit (null) for create mode.
Future<void> showNoteEditSheet(
  BuildContext context, {
  Note? note,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (BuildContext ctx) => NoteEditSheet(note: note),
  );
}

class NoteEditSheet extends ConsumerStatefulWidget {
  const NoteEditSheet({super.key, this.note});

  final Note? note;

  @override
  ConsumerState<NoteEditSheet> createState() => _NoteEditSheetState();
}

class _NoteEditSheetState extends ConsumerState<NoteEditSheet> {
  late final TextEditingController _bodyController;
  late String _color;
  late bool _pinned;
  bool _busy = false;

  bool get _isEdit => widget.note != null;

  @override
  void initState() {
    super.initState();
    _bodyController = TextEditingController(text: widget.note?.body ?? '');
    _color = widget.note?.color ?? 'sun';
    _pinned = widget.note?.pinned ?? false;
  }

  @override
  void dispose() {
    _bodyController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final String body = _bodyController.text.trim();
    if (body.isEmpty || _busy) {
      return;
    }

    final SessionState sessionState = ref.read(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return;
    }

    setState(() => _busy = true);
    final AppL10n l10n = AppL10n.of(context);
    final NotesService service = ref.read(notesServiceProvider);

    try {
      if (_isEdit) {
        await service.updateNote(
          session: session,
          id: widget.note!.id,
          body: body,
          color: _color,
          pinned: _pinned,
        );
      } else {
        await service.createNote(
          session: session,
          body: body,
          color: _color,
          pinned: _pinned,
        );
      }
      if (!mounted) {
        return;
      }
      ref.invalidate(notesProvider);
      Navigator.of(context).pop();
    } on NoteSessionRevokedException {
      if (!mounted) {
        return;
      }
      await ref.read(sessionProvider.notifier).clear();
    } on NoteCapReachedException {
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop();
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(l10n.notesErrorTooMany),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on NoteNotFoundException {
      if (!mounted) {
        return;
      }
      ref.invalidate(notesProvider);
      Navigator.of(context).pop();
    } on NoteFetchException {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(l10n.notesErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _delete() async {
    final AppL10n l10n = AppL10n.of(context);
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        content: Text(l10n.notesDeleteConfirm),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.notesDeleteConfirm),
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
      await ref.read(notesServiceProvider).deleteNote(
            session: session,
            id: widget.note!.id,
          );
      if (!mounted) {
        return;
      }
      ref.invalidate(notesProvider);
      Navigator.of(context).pop();
    } on NoteSessionRevokedException {
      if (!mounted) {
        return;
      }
      await ref.read(sessionProvider.notifier).clear();
    } on NoteNotFoundException {
      if (!mounted) {
        return;
      }
      ref.invalidate(notesProvider);
      Navigator.of(context).pop();
    } on NoteFetchException {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(AppL10n.of(context).notesErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final bool narrow = MediaQuery.sizeOf(context).width < 360;

    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  _isEdit ? l10n.notesEdit : l10n.notesCreate,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
              ),
              if (_isEdit)
                IconButton(
                  icon: const Icon(Icons.delete_outline),
                  tooltip: l10n.notesDeleteConfirm,
                  onPressed: _busy ? null : _delete,
                ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _bodyController,
            autofocus: true,
            minLines: 3,
            maxLines: 8,
            textInputAction: TextInputAction.newline,
            decoration: InputDecoration(
              hintText: l10n.notesBodyPlaceholder,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            l10n.notesColor,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          _ColorPicker(
            selectedColor: _color,
            onChanged: _busy ? null : (String c) => setState(() => _color = c),
            narrow: narrow,
          ),
          const SizedBox(height: 16),
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  l10n.notesPinned,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              ),
              Switch(
                value: _pinned,
                onChanged:
                    _busy ? null : (bool v) => setState(() => _pinned = v),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: <Widget>[
              Expanded(
                child: OutlinedButton(
                  onPressed: _busy ? null : () => Navigator.of(context).pop(),
                  child:
                      Text(MaterialLocalizations.of(context).cancelButtonLabel),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: _busy ? null : _save,
                  child: _busy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          MaterialLocalizations.of(context).saveButtonLabel,
                        ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ColorPicker extends StatelessWidget {
  const _ColorPicker({
    required this.selectedColor,
    required this.onChanged,
    required this.narrow,
  });

  final String selectedColor;
  final void Function(String)? onChanged;
  final bool narrow;

  @override
  Widget build(BuildContext context) {
    final double swatchSize = narrow ? 32.0 : 36.0;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _kAccentNames.map((String name) {
        final Color color = AccentPalette.resolve(name);
        final bool selected = name == selectedColor;
        return GestureDetector(
          onTap: onChanged != null ? () => onChanged!(name) : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            width: swatchSize,
            height: swatchSize,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: Border.all(
                color: selected
                    ? Theme.of(context).colorScheme.onSurface
                    : Colors.transparent,
                width: selected ? 3 : 0,
              ),
              boxShadow: selected
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
