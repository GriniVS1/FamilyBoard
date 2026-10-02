import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/mutations.dart';
import '../../models/session.dart';
import '../../models/todo_item.dart';
import '../../models/todo_sort.dart';
import '../../services/todos_service.dart';
import '../../state/session_provider.dart';
import '../../state/todos_provider.dart';
import '../../widgets/adaptive_layout.dart';
import '../../widgets/cached_at_pill.dart';
import '../../widgets/familyboard_logo.dart';
import '../../widgets/queue_badge.dart';
import '../../widgets/todo_composer.dart';
import '../../widgets/todo_row.dart';

/// Root-level To-dos screen, reached from the Mehr tab and the "Alle anzeigen"
/// link on the Heute To-dos card. To-dos are an adult area (R7.2); the kid
/// areas Heute and Aufgaben come first in the navigation.
class TodosScreen extends StatelessWidget {
  const TodosScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const FamilyBoardLogo(fontSize: 18),
        actions: const <Widget>[QueueBadge()],
      ),
      body: const SafeArea(child: ConstrainedContent(child: _TodosBody())),
    );
  }
}

// ---------------------------------------------------------------------------
// To-dos segment
// ---------------------------------------------------------------------------

class _TodosBody extends ConsumerStatefulWidget {
  const _TodosBody();

  @override
  ConsumerState<_TodosBody> createState() => _TodosBodyState();
}

class _TodosBodyState extends ConsumerState<_TodosBody> {
  final TextEditingController _addController = TextEditingController();
  bool _addBusy = false;
  DateTime? _addDueDate;

  @override
  void dispose() {
    _addController.dispose();
    super.dispose();
  }

  Future<void> _submitNew() async {
    final String title = _addController.text.trim();
    if (title.isEmpty || _addBusy) {
      return;
    }
    final SessionState sessionState = ref.read(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return;
    }
    setState(() => _addBusy = true);
    final AppL10n l10n = AppL10n.of(context);
    try {
      await ref
          .read(mutationsServiceProvider)
          .createTodo(session: session, title: title, dueDate: _addDueDate);
      if (!mounted) {
        return;
      }
      _addController.clear();
      setState(() => _addDueDate = null);
      ref.invalidate(todosProvider);
    } on MutationSessionRevokedException {
      if (!mounted) {
        return;
      }
      await ref.read(sessionProvider.notifier).clear();
    } on MutationCapReachedException {
      if (!mounted) {
        return;
      }
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(l10n.todosErrorTooMany),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on MutationFetchException {
      if (!mounted) {
        return;
      }
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(l10n.todosErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _addBusy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final AsyncValue<TodosResult> todosAsync = ref.watch(todosProvider);
    // /todos is only reachable signed-in (see the router redirect in
    // app.dart), so `session` is always non-null in practice here.
    final Session? session = ref.watch(sessionProvider).session;

    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          child: TodoComposerRow(
            controller: _addController,
            busy: _addBusy,
            l10n: l10n,
            dueDate: _addDueDate,
            onDueDateChanged: (DateTime? d) => setState(() => _addDueDate = d),
            onSubmit: _submitNew,
          ),
        ),
        Expanded(
          child: session == null
              ? const SizedBox.shrink()
              : todosAsync.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (Object err, StackTrace _) => _ErrorBody(
                    isSessionExpired: err is TodosSessionRevokedException,
                    l10n: l10n,
                    onRetry: () => ref.invalidate(todosProvider),
                    onSessionExpired: () async {
                      await ref.read(sessionProvider.notifier).clear();
                    },
                  ),
                  data: (TodosResult result) => _TodosList(
                    todos: result.todos,
                    staleAt: result.staleAt,
                    session: session,
                    l10n: l10n,
                    onRefresh: () async {
                      ref.invalidate(todosProvider);
                      try {
                        await ref.read(todosProvider.future);
                      } catch (_) {}
                    },
                  ),
                ),
        ),
      ],
    );
  }
}

class _TodosList extends StatelessWidget {
  const _TodosList({
    required this.todos,
    required this.staleAt,
    required this.session,
    required this.l10n,
    required this.onRefresh,
  });

  final List<TodoItem> todos;
  final DateTime? staleAt;
  final Session session;
  final AppL10n l10n;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    // Open (not-done) todos are grouped into due-date sections; done todos
    // are appended after, ungrouped — see `groupOpenTodosIntoSections`'s doc
    // for why completed items are excluded from bucketing.
    final List<TodoItem> sorted = sortTodosForDisplay(todos);
    final List<TodoItem> open = sorted.where((TodoItem t) => !t.done).toList();
    final List<TodoItem> done = sorted.where((TodoItem t) => t.done).toList();
    final List<TodoSection> sections = groupOpenTodosIntoSections(open);

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        children: <Widget>[
          if (staleAt != null) ...<Widget>[
            CachedAtPill(staleAt: staleAt),
            const SizedBox(height: 8),
          ],
          if (todos.isEmpty)
            SizedBox(
              height: MediaQuery.sizeOf(context).height * 0.4,
              child: Center(
                child: Text(
                  l10n.homeNoTodos,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(
                      context,
                    ).colorScheme.onSurface.withValues(alpha: 0.5),
                  ),
                ),
              ),
            )
          else ...<Widget>[
            for (final TodoSection section in sections) ...<Widget>[
              _TodoSectionHeader(
                label: todoDueBucketLabel(section.bucket, l10n),
              ),
              ...section.todos.map(
                (TodoItem t) => TodoRow(todo: t, session: session, l10n: l10n),
              ),
            ],
            ...done.map(
              (TodoItem t) => TodoRow(todo: t, session: session, l10n: l10n),
            ),
          ],
        ],
      ),
    );
  }
}

class _TodoSectionHeader extends StatelessWidget {
  const _TodoSectionHeader({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 6),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w600,
          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared error state
// ---------------------------------------------------------------------------

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({
    required this.isSessionExpired,
    required this.l10n,
    required this.onRetry,
    required this.onSessionExpired,
  });

  final bool isSessionExpired;
  final AppL10n l10n;
  final VoidCallback onRetry;
  final VoidCallback onSessionExpired;

  @override
  Widget build(BuildContext context) {
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
                  isSessionExpired
                      ? l10n.homeSessionExpired
                      : l10n.homeLoadError,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                  ),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: isSessionExpired ? onSessionExpired : onRetry,
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
