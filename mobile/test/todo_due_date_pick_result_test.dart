// Pins down the tri-state contract of `TodoDueDatePickResult`: a picked
// date, an explicit "remove", and "the sheet was dismissed" (represented as
// `pickTodoDueDate` returning null, outside this type) must never collapse
// into each other — see `pickTodoDueDate`'s doc in `todo_due_date_sheet.dart`.

import 'package:familyboard_mobile/widgets/todo_due_date_sheet.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('.date carries the picked date and is not a removal', () {
    final DateTime picked = DateTime(2026, 5, 11);
    final TodoDueDatePickResult result = TodoDueDatePickResult.date(picked);

    expect(result.date, picked);
    expect(result.remove, isFalse);
  });

  test('.remove carries no date and is flagged as a removal', () {
    const TodoDueDatePickResult result = TodoDueDatePickResult.remove();

    expect(result.date, isNull);
    expect(result.remove, isTrue);
  });
}
