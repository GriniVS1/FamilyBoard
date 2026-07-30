/// Shared to-do row — used by both the Home To-dos card and the Tasks
/// screen's To-dos segment. Previously each screen carried its own
/// near-identical `_TodoRow`/`_TaskTodoRow` (including a duplicated
/// `_duePill`/`_isOverdue` pair); this consolidates toggle / delete / queued
/// state / due-date editing into one widget so the two screens can't drift.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app.dart';
import '../l10n/generated/app_localizations.dart';
import '../models/mutations.dart';
import '../models/session.dart';
import '../models/todo_item.dart';
import '../models/todo_sort.dart';
import '../state/session_provider.dart';
import '../state/today_provider.dart';
import '../state/todos_provider.dart';
import 'member_chip.dart';
import 'todo_due_date_sheet.dart';

class TodoRow extends ConsumerStatefulWidget {
  const TodoRow({
    super.key,
    required this.todo,
    required this.session,
    required this.l10n,
  });

  final TodoItem todo;
  final Session session;
  final AppL10n l10n;

  @override
  ConsumerState<TodoRow> createState() => _TodoRowState();
}

class _TodoRowState extends ConsumerState<TodoRow> {
  bool _busy = false;
  bool _optimisticDone = false;
  bool _doneOverride = false;
  DateTime? _optimisticDueDate;
  bool _dueDateOverride = false;
  bool _isQueued = false;

  bool get _isDone => _doneOverride ? _optimisticDone : widget.todo.done;
  DateTime? get _dueDate =>
      _dueDateOverride ? _optimisticDueDate : widget.todo.dueDate;

  Future<void> _toggle() async {
    if (_busy) {
      return;
    }
    final bool newDone = !_isDone;
    setState(() {
      _busy = true;
      _optimisticDone = newDone;
      _doneOverride = true;
    });

    try {
      final TodoMutation result = await ref
          .read(mutationsServiceProvider)
          .toggleTodo(
            session: widget.session,
            id: widget.todo.id,
            done: newDone,
          );
      if (!mounted) {
        return;
      }
      // An empty title signals a queued synthetic result.
      if (result.title.isEmpty) {
        setState(() {
          _isQueued = true;
          _busy = false;
        });
        return;
      }
      ref.invalidate(todosProvider);
      ref.invalidate(todayProvider);
    } on MutationSessionRevokedException {
      if (!mounted) {
        return;
      }
      setState(() {
        _doneOverride = false;
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
        _doneOverride = true;
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
      builder: (BuildContext ctx) {
        return AlertDialog(
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
        );
      },
    );
    if (confirmed != true || !mounted) {
      return;
    }

    try {
      await ref
          .read(mutationsServiceProvider)
          .deleteTodo(session: widget.session, id: widget.todo.id);
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

  Future<void> _editDueDate() async {
    if (_busy) {
      return;
    }
    final TodoDueDatePickResult? pick = await pickTodoDueDate(
      context: context,
      l10n: widget.l10n,
      current: _dueDate,
    );
    if (pick == null || !mounted) {
      return;
    }
    final DateTime? newDueDate = pick.remove ? null : pick.date;
    final DateTime? previous = _dueDate;

    setState(() {
      _busy = true;
      _optimisticDueDate = newDueDate;
      _dueDateOverride = true;
    });

    try {
      final TodoMutation result = await ref
          .read(mutationsServiceProvider)
          .updateTodoDueDate(
            session: widget.session,
            id: widget.todo.id,
            dueDate: newDueDate,
          );
      if (!mounted) {
        return;
      }
      if (result.title.isEmpty) {
        setState(() {
          _isQueued = true;
          _busy = false;
        });
        return;
      }
      ref.invalidate(todosProvider);
      ref.invalidate(todayProvider);
    } on MutationSessionRevokedException {
      if (!mounted) {
        return;
      }
      setState(() {
        _dueDateOverride = false;
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
        _optimisticDueDate = previous;
        _dueDateOverride = true;
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

  @override
  Widget build(BuildContext context) {
    final bool done = _isDone;
    final Color mutedColor = Theme.of(
      context,
    ).colorScheme.onSurface.withValues(alpha: 0.4);
    final String? duePill = todoDueLabel(_dueDate, widget.l10n);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Opacity(
        opacity: _isQueued ? 0.6 : 1.0,
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
                GestureDetector(
                  onTap: _busy ? null : _toggle,
                  behavior: HitTestBehavior.opaque,
                  child: Padding(
                    padding: const EdgeInsets.only(right: 10),
                    child: SizedBox(
                      width: 32,
                      height: 32,
                      child: _busy
                          ? const Center(
                              child: SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ),
                            )
                          : _isQueued
                          ? Icon(
                              Icons.schedule,
                              size: 20,
                              color: Theme.of(
                                context,
                              ).colorScheme.onSurface.withValues(alpha: 0.4),
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
                  ),
                ),
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
                if (_isQueued) ...<Widget>[
                  const SizedBox(width: 4),
                  Text(
                    widget.l10n.queuedRow,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(
                        context,
                      ).colorScheme.onSurface.withValues(alpha: 0.4),
                      fontSize: 11,
                    ),
                  ),
                ] else ...<Widget>[
                  const SizedBox(width: 8),
                  if (duePill != null)
                    _TodoDuePillButton(
                      label: duePill,
                      overdue: isTodoOverdue(_dueDate),
                      onTap: _busy ? null : _editDueDate,
                    )
                  else
                    _TodoAddDueDateButton(
                      tooltip: widget.l10n.todosDueTooltip,
                      onTap: _busy ? null : _editDueDate,
                    ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TodoDuePillButton extends StatelessWidget {
  const _TodoDuePillButton({
    required this.label,
    required this.overdue,
    required this.onTap,
  });

  final String label;
  final bool overdue;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final Color bg = overdue
        ? Theme.of(context).colorScheme.errorContainer
        : Theme.of(context).colorScheme.secondaryContainer;
    final Color fg = overdue
        ? Theme.of(context).colorScheme.onErrorContainer
        : Theme.of(context).colorScheme.onSecondaryContainer;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        constraints: const BoxConstraints(minHeight: 32),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Center(
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: fg,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ),
      ),
    );
  }
}

/// Subtle calendar-icon affordance shown on undated rows so a due date can be
/// added without first creating one via the composer.
class _TodoAddDueDateButton extends StatelessWidget {
  const _TodoAddDueDateButton({required this.tooltip, required this.onTap});

  final String tooltip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 44,
      height: 44,
      child: IconButton(
        padding: EdgeInsets.zero,
        tooltip: tooltip,
        icon: Icon(
          Icons.calendar_month_outlined,
          size: 18,
          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4),
        ),
        onPressed: onTap,
      ),
    );
  }
}
