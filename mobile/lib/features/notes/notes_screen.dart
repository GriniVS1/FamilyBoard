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
import '../../widgets/cached_at_pill.dart';
import '../../widgets/familyboard_logo.dart';
import '../../widgets/queue_badge.dart';
import 'note_edit_sheet.dart';

class NotesScreen extends ConsumerWidget {
  const NotesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppL10n l10n = AppL10n.of(context);
    final AsyncValue<NotesResult> notesAsync = ref.watch(notesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const FamilyBoardLogo(fontSize: 18),
        actions: <Widget>[
          const QueueBadge(),
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Tooltip(
              message: l10n.notesCreate,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  minimumSize: const Size(52, 52),
                  padding: EdgeInsets.zero,
                  shape: const CircleBorder(),
                ),
                onPressed: () => showNoteEditSheet(context),
                child: const Icon(Icons.add),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(notesProvider);
            try {
              await ref.read(notesProvider.future);
            } catch (_) {}
          },
          child: notesAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (Object err, StackTrace _) => _ErrorBody(
              error: err,
              l10n: l10n,
              onRetry: () => ref.invalidate(notesProvider),
              onSessionExpired: () async {
                await ref.read(sessionProvider.notifier).clear();
              },
            ),
            data: (NotesResult result) => _NotesList(
              notes: result.notes,
              l10n: l10n,
              staleAt: result.staleAt,
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Notes list / grid
// ---------------------------------------------------------------------------

class _NotesList extends ConsumerWidget {
  const _NotesList({
    required this.notes,
    required this.l10n,
    this.staleAt,
  });

  final List<Note> notes;
  final AppL10n l10n;
  final DateTime? staleAt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (notes.isEmpty) {
      return _EmptyState(l10n: l10n);
    }

    // Pinned first, then chronological.
    final List<Note> sorted = <Note>[
      ...notes.where((Note n) => n.pinned),
      ...notes.where((Note n) => !n.pinned),
    ];

    final bool narrow = MediaQuery.sizeOf(context).width < 360;
    final int crossAxisCount = narrow ? 1 : 2;

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: <Widget>[
        if (staleAt != null)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: CachedAtPill(staleAt: staleAt),
            ),
          ),
        SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverGrid(
            delegate: SliverChildBuilderDelegate(
              (BuildContext ctx, int index) {
                final Note note = sorted[index];
                return _NoteCard(note: note, l10n: l10n);
              },
              childCount: sorted.length,
            ),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: crossAxisCount,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 0.9,
            ),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Individual card
// ---------------------------------------------------------------------------

class _NoteCard extends ConsumerStatefulWidget {
  const _NoteCard({required this.note, required this.l10n});

  final Note note;
  final AppL10n l10n;

  @override
  ConsumerState<_NoteCard> createState() => _NoteCardState();
}

class _NoteCardState extends ConsumerState<_NoteCard> {
  bool _busy = false;

  Future<void> _handleLongPress() async {
    final AppL10n l10n = widget.l10n;
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
            id: widget.note.id,
          );
      if (!mounted) {
        return;
      }
      ref.invalidate(notesProvider);
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
    } on NoteFetchException {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(widget.l10n.notesErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final Note note = widget.note;
    final Color accent = AccentPalette.resolve(note.color);
    final Color cardBg = accent.withValues(alpha: 0.3);
    final Color onCard = Theme.of(context).colorScheme.onSurface;

    return GestureDetector(
      onTap: _busy ? null : () => showNoteEditSheet(context, note: note),
      onLongPress: _busy ? null : _handleLongPress,
      child: AnimatedOpacity(
        opacity: _busy ? 0.5 : 1.0,
        duration: const Duration(milliseconds: 150),
        child: Container(
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: accent.withValues(alpha: 0.5),
            ),
          ),
          padding: const EdgeInsets.all(14),
          child: Stack(
            children: <Widget>[
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Expanded(
                    child: Text(
                      note.body,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: onCard,
                            height: 1.4,
                          ),
                      maxLines: 6,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (note.author != null) ...<Widget>[
                    const SizedBox(height: 8),
                    _AuthorChip(author: note.author!, l10n: widget.l10n),
                  ],
                ],
              ),
              if (note.pinned)
                Positioned(
                  top: 0,
                  right: 0,
                  child: Icon(
                    Icons.push_pin,
                    size: 16,
                    color: onCard.withValues(alpha: 0.5),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AuthorChip extends StatelessWidget {
  const _AuthorChip({required this.author, required this.l10n});

  final NoteAuthor author;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(
            author.emoji,
            style: const TextStyle(fontSize: 12),
          ),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              l10n.notesByAuthor(author.name),
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.l10n});

  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: <Widget>[
        SizedBox(
          height: MediaQuery.sizeOf(context).height * 0.4,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Icon(
                Icons.sticky_note_2_outlined,
                size: 56,
                color: Theme.of(context)
                    .colorScheme
                    .onSurface
                    .withValues(alpha: 0.25),
              ),
              const SizedBox(height: 16),
              Text(
                l10n.notesEmpty,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.5),
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                l10n.notesEmptySubtitle,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.4),
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({
    required this.error,
    required this.l10n,
    required this.onRetry,
    required this.onSessionExpired,
  });

  final Object error;
  final AppL10n l10n;
  final VoidCallback onRetry;
  final VoidCallback onSessionExpired;

  @override
  Widget build(BuildContext context) {
    final bool isSessionError = error is NoteSessionRevokedException;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  isSessionError ? l10n.homeSessionExpired : l10n.homeLoadError,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.error,
                      ),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: isSessionError ? onSessionExpired : onRetry,
                  child: Text(l10n.homeRetry),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
