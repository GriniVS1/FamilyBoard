---
title: R6.3 admin-gating tests would pass for a hidden-but-present manage target
severity: P3
area: frontend
owner: frontend-developer
status: fixed
slice: mobile kids-UI screens (Aufgaben, Heute) 0.3.0
created: 2026-10-02T10:12:11Z
---

## Reproduction

1. Read mobile/test/kids_screens_test.dart, group "R6.3 admin gating".
2. In a scratch copy, wrap the "+" button in `Visibility(visible: false, maintainState: true)` or `Offstage` for non-admins.
3. Run the group.

## Expected

The ruling says child sessions see no manage controls, "auch keine unsichtbaren". The test should fail when a target exists but is invisible.

## Actual

The assertions are `find.byIcon(Icons.add_rounded)`, `find.byType(FloatingActionButton)` and `find.text('Aufgabe für Mia hinzufügen')`. All use the default `skipOffstage: true` and the text finder looks at Text widgets, not the semantics tree, so an offstage or semantics-only target is not found and the test stays green. The current implementation is correct (the button is built conditionally with `if (isAdmin)` / `onAdd != null`, verified by reading the code), so this is a test-strength gap only.

## Evidence

```text
expect(_addButton(), findsNothing);
expect(find.byType(FloatingActionButton), findsNothing);
expect(find.text('Aufgabe für Mia hinzufügen'), findsNothing);
```

## Notes

Use `skipOffstage: false` and a semantics assertion (`find.bySemanticsLabel(RegExp('hinzufügen'))` with `ensureSemantics()`) for the child session. Same for the Heute test. Also note there is no widget test for the new TodosScreen (the old tasks_screen_widget_test.dart To-dos segment test was deleted without replacement) and none for the /grocery and /todos router entries.

## Fix

`mobile/test/kids_screens_test.dart`, group "R6.3 admin gating": the child-session assertions now use `_expectNoManageTargets`, which checks with `skipOffstage: false` that no `KidRoundButton` labelled "...hinzufügen", no `add_rounded` icon, no `FloatingActionButton` and no `Semantics` node with such a label exists, plus `find.bySemanticsLabel(RegExp('hinzufügen'))` under `ensureSemantics()`. It is used for the Aufgaben board, the empty state and the Heute chore card. A meta test proves the detector sees a target hidden with `Offstage` or `Visibility(visible: false, maintainState: true)`. The admin case asserts the same predicate finds exactly one target.

New `mobile/test/todos_screen_test.dart` restores the To-dos coverage on `TodosScreen` (`/todos`): list with assignee and composer, load error with a working retry, loading state. The test harness now disables Riverpod's auto-retry like `main.dart`. Router entries `/grocery` and `/todos` in `app.dart` are not covered by a widget test (the router is private to `FamilyBoardApp`, which needs platform channels).

Cleanups from the same review: the dead `todayProvider` invalidations are removed from `todo_row.dart` and `chore_create_sheet.dart`. Nothing watched the provider any more, so the whole today stack (`todayProvider`, `TodayService`, `todayServiceProvider`, `models/today.dart`, `today_chore_model_test.dart`) is deleted and `allDataProviders` no longer lists it. Stale comments that described Einkauf as a tab or the Tasks screen as a pushed route were updated.
