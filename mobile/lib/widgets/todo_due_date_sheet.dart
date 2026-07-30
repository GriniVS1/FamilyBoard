/// Shared due-date picker sheet for to-dos — used by the create composer
/// (`TodoComposerRow`) and by [TodoRow]'s tap-to-edit affordance so both
/// entry points offer the same Heute / Morgen / Datum wählen… / Datum
/// entfernen options instead of diverging.
library;

import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../models/todo_sort.dart';

enum _DueDateChoice { today, tomorrow, custom, remove }

/// Result of [pickTodoDueDate]: either a concrete new date, or an explicit
/// "remove the date" — kept distinct from "user dismissed the sheet" (which
/// returns null from [pickTodoDueDate] itself) so callers never confuse
/// "no change" with "clear the date".
class TodoDueDatePickResult {
  const TodoDueDatePickResult.date(this.date) : remove = false;

  const TodoDueDatePickResult.remove() : date = null, remove = true;

  final DateTime? date;
  final bool remove;
}

/// Opens the due-date choice sheet. Returns null if the user dismissed it
/// without choosing anything. [current] gates whether "Datum entfernen" is
/// offered (only when a date is already set).
Future<TodoDueDatePickResult?> pickTodoDueDate({
  required BuildContext context,
  required AppL10n l10n,
  DateTime? current,
}) async {
  final _DueDateChoice? choice = await showModalBottomSheet<_DueDateChoice>(
    context: context,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (BuildContext ctx) =>
        _DueDateChoiceSheet(l10n: l10n, canRemove: current != null),
  );
  if (choice == null || !context.mounted) {
    return null;
  }

  switch (choice) {
    case _DueDateChoice.today:
      return TodoDueDatePickResult.date(todoMidnight());
    case _DueDateChoice.tomorrow:
      return TodoDueDatePickResult.date(
        todoMidnight().add(const Duration(days: 1)),
      );
    case _DueDateChoice.remove:
      return const TodoDueDatePickResult.remove();
    case _DueDateChoice.custom:
      final DateTime now = DateTime.now();
      final DateTime? picked = await showDatePicker(
        context: context,
        initialDate: current ?? todoMidnight(),
        firstDate: now.subtract(const Duration(days: 365)),
        lastDate: now.add(const Duration(days: 365 * 2)),
      );
      if (picked == null) {
        return null;
      }
      return TodoDueDatePickResult.date(picked);
  }
}

class _DueDateChoiceSheet extends StatelessWidget {
  const _DueDateChoiceSheet({required this.l10n, required this.canRemove});

  final AppL10n l10n;
  final bool canRemove;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            ListTile(
              leading: const Icon(Icons.today_outlined),
              title: Text(l10n.todosDueQuickToday),
              onTap: () => Navigator.of(context).pop(_DueDateChoice.today),
            ),
            ListTile(
              leading: const Icon(Icons.event_outlined),
              title: Text(l10n.todosDueQuickTomorrow),
              onTap: () => Navigator.of(context).pop(_DueDateChoice.tomorrow),
            ),
            ListTile(
              leading: const Icon(Icons.calendar_month_outlined),
              title: Text(l10n.todosDuePickCustom),
              onTap: () => Navigator.of(context).pop(_DueDateChoice.custom),
            ),
            if (canRemove)
              ListTile(
                leading: const Icon(Icons.event_busy_outlined),
                title: Text(l10n.todosDueRemove),
                onTap: () => Navigator.of(context).pop(_DueDateChoice.remove),
              ),
          ],
        ),
      ),
    );
  }
}
