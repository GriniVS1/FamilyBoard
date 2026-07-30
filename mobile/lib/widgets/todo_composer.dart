/// Shared "add a to-do" composer row — title field, an optional due-date
/// affordance, and the submit button. Used by both the Home To-dos card and
/// the Tasks screen's To-dos segment.
///
/// Fully controlled: the parent's `State` owns [controller], [busy] and the
/// picked [dueDate] (mirroring how `EventEditSheet` owns its own form
/// fields) — this widget only renders and reports taps/picks back up via
/// [onSubmit] / [onDueDateChanged].
library;

import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../models/todo_sort.dart';
import 'todo_due_date_sheet.dart';

class TodoComposerRow extends StatelessWidget {
  const TodoComposerRow({
    super.key,
    required this.controller,
    required this.busy,
    required this.l10n,
    required this.dueDate,
    required this.onDueDateChanged,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final bool busy;
  final AppL10n l10n;
  final DateTime? dueDate;
  final ValueChanged<DateTime?> onDueDateChanged;
  final VoidCallback onSubmit;

  Future<void> _pickDate(BuildContext context) async {
    final TodoDueDatePickResult? pick = await pickTodoDueDate(
      context: context,
      l10n: l10n,
      current: dueDate,
    );
    if (pick == null) {
      return;
    }
    onDueDateChanged(pick.remove ? null : pick.date);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
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
            const SizedBox(width: 4),
            SizedBox(
              width: 44,
              height: 44,
              child: IconButton(
                padding: EdgeInsets.zero,
                tooltip: l10n.todosDueTooltip,
                icon: Icon(
                  Icons.calendar_month_outlined,
                  color: dueDate != null
                      ? Theme.of(context).colorScheme.primary
                      : null,
                ),
                onPressed: busy ? null : () => _pickDate(context),
              ),
            ),
            const SizedBox(width: 4),
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
        ),
        if (dueDate != null) ...<Widget>[
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.only(left: 4),
            child: InputChip(
              visualDensity: VisualDensity.compact,
              label: Text(todoDueLabel(dueDate, l10n) ?? ''),
              onDeleted: busy ? null : () => onDueDateChanged(null),
              deleteIconColor: Theme.of(
                context,
              ).colorScheme.onSurface.withValues(alpha: 0.5),
            ),
          ),
        ],
      ],
    );
  }
}
