import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chore.dart';
import '../../models/family_member.dart';
import '../../models/mutations.dart';
import '../../models/session.dart';
import '../../models/todo_item.dart';
import '../../services/chores_service.dart';
import '../../services/todos_service.dart';
import '../../state/chores_provider.dart';
import '../../state/members_provider.dart';
import '../../state/session_provider.dart';
import '../../state/today_provider.dart';
import '../../state/todos_provider.dart';
import '../../widgets/cached_at_pill.dart';
import '../../widgets/familyboard_logo.dart';
import '../../widgets/member_chip.dart';
import '../../widgets/queue_badge.dart';
import '../chores/chore_create_sheet.dart';

enum _TasksTab { chores, todos }

/// Root-level screen (like `/notes`) showing the full family Ämtli and
/// To-dos lists. Reached from the Mehr tab and the "Alle anzeigen" links on
/// the Home Ämtli/To-dos cards, which are capped/filtered for the dashboard.
class TasksScreen extends ConsumerStatefulWidget {
  const TasksScreen({super.key});

  @override
  ConsumerState<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends ConsumerState<TasksScreen> {
  _TasksTab _tab = _TasksTab.chores;

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final AsyncValue<MembersResult> membersAsync = ref.watch(membersProvider);
    final bool isAdmin = membersAsync.value?.isAdmin ?? false;

    return Scaffold(
      appBar: AppBar(
        title: const FamilyBoardLogo(fontSize: 18),
        actions: const <Widget>[QueueBadge()],
      ),
      body: SafeArea(
        child: Column(
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: SegmentedButton<_TasksTab>(
                segments: <ButtonSegment<_TasksTab>>[
                  ButtonSegment<_TasksTab>(
                    value: _TasksTab.chores,
                    label: Text(l10n.homeChoresCard),
                  ),
                  ButtonSegment<_TasksTab>(
                    value: _TasksTab.todos,
                    label: Text(l10n.homeTodosCard),
                  ),
                ],
                selected: <_TasksTab>{_tab},
                onSelectionChanged: (Set<_TasksTab> sel) =>
                    setState(() => _tab = sel.first),
              ),
            ),
            Expanded(
              child: _tab == _TasksTab.chores
                  ? const _ChoresSegment()
                  : const _TodosSegment(),
            ),
          ],
        ),
      ),
      floatingActionButton: _tab == _TasksTab.chores && isAdmin
          ? FloatingActionButton(
              onPressed: () => showChoreCreateSheet(context),
              tooltip: l10n.choresAddAria,
              child: const Icon(Icons.add),
            )
          : null,
    );
  }
}

// ---------------------------------------------------------------------------
// Ämtli segment
// ---------------------------------------------------------------------------

class _ChoresSegment extends ConsumerWidget {
  const _ChoresSegment();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppL10n l10n = AppL10n.of(context);
    final AsyncValue<ChoresResult> choresAsync = ref.watch(choresProvider);

    return choresAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (Object err, StackTrace _) => _ErrorBody(
        isSessionExpired: err is ChoresSessionRevokedException,
        l10n: l10n,
        onRetry: () => ref.invalidate(choresProvider),
        onSessionExpired: () async {
          await ref.read(sessionProvider.notifier).clear();
        },
      ),
      data: (ChoresResult result) => _ChoresList(
        chores: result.chores,
        staleAt: result.staleAt,
        l10n: l10n,
        onRefresh: () async {
          ref.invalidate(choresProvider);
          try {
            await ref.read(choresProvider.future);
          } catch (_) {}
        },
      ),
    );
  }
}

class _ChoresList extends StatelessWidget {
  const _ChoresList({
    required this.chores,
    required this.staleAt,
    required this.l10n,
    required this.onRefresh,
  });

  final List<Chore> chores;
  final DateTime? staleAt;
  final AppL10n l10n;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        children: <Widget>[
          if (staleAt != null) ...<Widget>[
            CachedAtPill(staleAt: staleAt),
            const SizedBox(height: 8),
          ],
          if (chores.isEmpty)
            SizedBox(
              height: MediaQuery.sizeOf(context).height * 0.4,
              child: Center(
                child: Text(
                  l10n.homeNoChores,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(
                      context,
                    ).colorScheme.onSurface.withValues(alpha: 0.5),
                  ),
                ),
              ),
            )
          else
            ...chores.map((Chore c) => _ChoreListRow(chore: c, l10n: l10n)),
        ],
      ),
    );
  }
}

class _ChoreListRow extends ConsumerStatefulWidget {
  const _ChoreListRow({required this.chore, required this.l10n});

  final Chore chore;
  final AppL10n l10n;

  @override
  ConsumerState<_ChoreListRow> createState() => _ChoreListRowState();
}

class _ChoreListRowState extends ConsumerState<_ChoreListRow> {
  bool _busy = false;
  bool _optimisticDone = false;
  bool _optimisticOverride = false;

  bool get _isDone =>
      _optimisticOverride ? _optimisticDone : widget.chore.completedToday;

  Future<void> _handleTap() async {
    if (_busy) {
      return;
    }
    final SessionState sessionState = ref.read(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return;
    }
    if (_isDone) {
      await _handleUndo(session);
    } else {
      await _handleComplete(session);
    }
  }

  Future<void> _handleComplete(Session session) async {
    setState(() {
      _busy = true;
      _optimisticDone = true;
      _optimisticOverride = true;
    });
    try {
      await ref
          .read(mutationsServiceProvider)
          .completeChore(session: session, id: widget.chore.id);
      if (!mounted) {
        return;
      }
      ref.invalidate(choresProvider);
      ref.invalidate(todayProvider);
    } on MutationSessionRevokedException {
      if (!mounted) {
        return;
      }
      setState(() {
        _optimisticOverride = false;
        _busy = false;
      });
      await ref.read(sessionProvider.notifier).clear();
    } on MutationNotFoundException {
      if (!mounted) {
        return;
      }
      ref.invalidate(choresProvider);
    } on MutationFetchException {
      if (!mounted) {
        return;
      }
      setState(() {
        _optimisticOverride = false;
        _busy = false;
      });
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(widget.l10n.choresErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _handleUndo(Session session) async {
    final AppL10n l10n = widget.l10n;
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        content: Text(l10n.choresUndoConfirm),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.mutationErrorRetry),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) {
      return;
    }

    setState(() {
      _busy = true;
      _optimisticDone = false;
      _optimisticOverride = true;
    });
    try {
      await ref
          .read(mutationsServiceProvider)
          .undoChoreCompletion(session: session, id: widget.chore.id);
      if (!mounted) {
        return;
      }
      ref.invalidate(choresProvider);
      ref.invalidate(todayProvider);
    } on MutationSessionRevokedException {
      if (!mounted) {
        return;
      }
      setState(() {
        _optimisticOverride = false;
        _busy = false;
      });
      await ref.read(sessionProvider.notifier).clear();
    } on MutationNotFoundException {
      if (!mounted) {
        return;
      }
      ref.invalidate(choresProvider);
    } on MutationFetchException {
      if (!mounted) {
        return;
      }
      setState(() {
        _optimisticOverride = false;
        _busy = false;
      });
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(widget.l10n.choresErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool done = _isDone;
    final Chore chore = widget.chore;
    final Color mutedColor = Theme.of(
      context,
    ).colorScheme.onSurface.withValues(alpha: 0.4);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: _busy ? null : _handleTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          constraints: const BoxConstraints(minHeight: 56),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Theme.of(context).colorScheme.outline),
          ),
          child: Row(
            children: <Widget>[
              if (chore.icon != null && chore.icon!.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: Text(
                    chore.icon!,
                    style: const TextStyle(fontSize: 22),
                  ),
                ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      chore.title,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: done ? mutedColor : null,
                        decoration: done ? TextDecoration.lineThrough : null,
                        decorationColor: mutedColor,
                      ),
                    ),
                    if (done && chore.completedTodayBy != null)
                      Text(
                        widget.l10n.tasksChoreCompletedBy(
                          chore.completedTodayBy!.name,
                        ),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(
                            context,
                          ).colorScheme.onSurface.withValues(alpha: 0.5),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (chore.member != null)
                MemberChip(
                  name: chore.member!.name,
                  color: chore.member!.color,
                  emoji: chore.member!.emoji,
                )
              else
                UnassignedChip(label: widget.l10n.tasksChoreUnassigned),
              const SizedBox(width: 8),
              if (_busy)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                Text(
                  done ? '★' : '☆',
                  style: TextStyle(
                    fontSize: 20,
                    color: done
                        ? const Color(0xFFFFD166)
                        : Theme.of(
                            context,
                          ).colorScheme.onSurface.withValues(alpha: 0.3),
                  ),
                ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: done
                      ? Theme.of(
                          context,
                        ).colorScheme.outline.withValues(alpha: 0.3)
                      : Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  widget.l10n.homePointsLabel(chore.points),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: done
                        ? mutedColor
                        : Theme.of(context).colorScheme.onPrimaryContainer,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// To-dos segment
// ---------------------------------------------------------------------------

class _TodosSegment extends ConsumerStatefulWidget {
  const _TodosSegment();

  @override
  ConsumerState<_TodosSegment> createState() => _TodosSegmentState();
}

class _TodosSegmentState extends ConsumerState<_TodosSegment> {
  final TextEditingController _addController = TextEditingController();
  bool _addBusy = false;

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
          .createTodo(session: session, title: title);
      if (!mounted) {
        return;
      }
      _addController.clear();
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

    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          child: _TaskAddTodoRow(
            controller: _addController,
            busy: _addBusy,
            l10n: l10n,
            onSubmit: _submitNew,
          ),
        ),
        Expanded(
          child: todosAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
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

class _TaskAddTodoRow extends StatelessWidget {
  const _TaskAddTodoRow({
    required this.controller,
    required this.busy,
    required this.l10n,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final bool busy;
  final AppL10n l10n;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(
          child: TextField(
            controller: controller,
            enabled: !busy,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => onSubmit(),
            decoration: InputDecoration(
              hintText: l10n.todosAddPlaceholder,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 10,
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          height: 48,
          width: 48,
          child: busy
              ? const Center(
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : IconButton.filled(
                  icon: const Icon(Icons.add),
                  tooltip: l10n.todosAddButton,
                  onPressed: onSubmit,
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
    required this.l10n,
    required this.onRefresh,
  });

  final List<TodoItem> todos;
  final DateTime? staleAt;
  final AppL10n l10n;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
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
          else
            ...todos.map((TodoItem t) => _TaskTodoRow(todo: t, l10n: l10n)),
        ],
      ),
    );
  }
}

class _TaskTodoRow extends ConsumerStatefulWidget {
  const _TaskTodoRow({required this.todo, required this.l10n});

  final TodoItem todo;
  final AppL10n l10n;

  @override
  ConsumerState<_TaskTodoRow> createState() => _TaskTodoRowState();
}

class _TaskTodoRowState extends ConsumerState<_TaskTodoRow> {
  bool _busy = false;
  bool _optimisticDone = false;
  bool _optimisticOverride = false;

  bool get _isDone => _optimisticOverride ? _optimisticDone : widget.todo.done;

  Future<void> _toggle() async {
    if (_busy) {
      return;
    }
    final SessionState sessionState = ref.read(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return;
    }
    final bool newDone = !_isDone;
    setState(() {
      _busy = true;
      _optimisticDone = newDone;
      _optimisticOverride = true;
    });

    try {
      await ref
          .read(mutationsServiceProvider)
          .toggleTodo(session: session, id: widget.todo.id, done: newDone);
      if (!mounted) {
        return;
      }
      ref.invalidate(todosProvider);
    } on MutationSessionRevokedException {
      if (!mounted) {
        return;
      }
      setState(() {
        _optimisticOverride = false;
        _busy = false;
      });
      await ref.read(sessionProvider.notifier).clear();
    } on MutationNotFoundException {
      if (!mounted) {
        return;
      }
      ref.invalidate(todosProvider);
    } on MutationFetchException {
      if (!mounted) {
        return;
      }
      setState(() {
        _optimisticDone = !newDone;
        _optimisticOverride = true;
        _busy = false;
      });
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(widget.l10n.todosErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _delete() async {
    final AppL10n l10n = widget.l10n;
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        content: Text(l10n.todosDeleteConfirm),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.todosDeleteConfirm),
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
    try {
      await ref
          .read(mutationsServiceProvider)
          .deleteTodo(session: session, id: widget.todo.id);
      if (!mounted) {
        return;
      }
      ref.invalidate(todosProvider);
    } on MutationSessionRevokedException {
      if (!mounted) {
        return;
      }
      await ref.read(sessionProvider.notifier).clear();
    } on MutationNotFoundException {
      if (!mounted) {
        return;
      }
      ref.invalidate(todosProvider);
    } on MutationFetchException {
      if (!mounted) {
        return;
      }
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(widget.l10n.todosErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  String? _duePill(DateTime? dueDate, AppL10n l10n) {
    if (dueDate == null) {
      return null;
    }
    final DateTime now = DateTime.now();
    final DateTime today = DateTime(now.year, now.month, now.day);
    final DateTime due = DateTime(dueDate.year, dueDate.month, dueDate.day);
    final int diff = due.difference(today).inDays;
    if (diff == 0) {
      return l10n.homeDueToday;
    }
    if (diff == 1) {
      return l10n.homeDueTomorrow;
    }
    if (diff < 0) {
      return l10n.homeOverdue(DateFormat('EEE d.M').format(dueDate.toLocal()));
    }
    return l10n.homeDueOn(DateFormat('EEE d.M').format(dueDate.toLocal()));
  }

  bool _isOverdue(DateTime? dueDate) {
    if (dueDate == null) {
      return false;
    }
    final DateTime now = DateTime.now();
    final DateTime today = DateTime(now.year, now.month, now.day);
    final DateTime due = DateTime(dueDate.year, dueDate.month, dueDate.day);
    return due.isBefore(today);
  }

  @override
  Widget build(BuildContext context) {
    final bool done = _isDone;
    final Color mutedColor = Theme.of(
      context,
    ).colorScheme.onSurface.withValues(alpha: 0.4);
    final String? duePill = _duePill(widget.todo.dueDate, widget.l10n);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: _busy ? null : _toggle,
        onLongPress: _busy ? null : _delete,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          constraints: const BoxConstraints(minHeight: 56),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Theme.of(context).colorScheme.outline),
          ),
          child: Row(
            children: <Widget>[
              SizedBox(
                width: 32,
                height: 32,
                child: _busy
                    ? const Center(
                        child: SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : Icon(
                        done
                            ? Icons.check_circle_rounded
                            : Icons.radio_button_unchecked_rounded,
                        color: done
                            ? mutedColor
                            : Theme.of(context).colorScheme.primary,
                        size: 24,
                      ),
              ),
              const SizedBox(width: 10),
              if (widget.todo.member != null) ...<Widget>[
                MemberChip(
                  name: widget.todo.member!.name,
                  color: widget.todo.member!.color,
                  emoji: widget.todo.member!.emoji,
                ),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: Text(
                  widget.todo.title,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: done ? mutedColor : null,
                    decoration: done ? TextDecoration.lineThrough : null,
                    decorationColor: mutedColor,
                  ),
                ),
              ),
              if (duePill != null) ...<Widget>[
                const SizedBox(width: 8),
                _TaskDuePill(
                  label: duePill,
                  overdue: _isOverdue(widget.todo.dueDate),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _TaskDuePill extends StatelessWidget {
  const _TaskDuePill({required this.label, required this.overdue});

  final String label;
  final bool overdue;

  @override
  Widget build(BuildContext context) {
    final Color bg = overdue
        ? Theme.of(context).colorScheme.errorContainer
        : Theme.of(context).colorScheme.secondaryContainer;
    final Color fg = overdue
        ? Theme.of(context).colorScheme.onErrorContainer
        : Theme.of(context).colorScheme.onSecondaryContainer;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: fg,
          fontWeight: FontWeight.w600,
          fontSize: 12,
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
