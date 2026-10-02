// Widget tests of the screens built on the kid components: Aufgaben (admin
// gating, read-only boards, R9 states, semantics), the optimistic chore
// actions and the picto picker of the create sheet.

import 'dart:async';
import 'dart:io';

import 'package:familyboard_mobile/features/chores/chore_create_sheet.dart';
import 'package:familyboard_mobile/features/home/kid_home_chores.dart';
import 'package:familyboard_mobile/features/tasks/tasks_screen.dart';
import 'package:familyboard_mobile/kids/kid_chore_card.dart';
import 'package:familyboard_mobile/kids/kid_states.dart';
import 'package:familyboard_mobile/kids/kid_tap.dart';
import 'package:familyboard_mobile/kids/kid_theme.dart';
import 'package:familyboard_mobile/kids/picto.dart';
import 'package:familyboard_mobile/kids/picto_resolver.dart';
import 'package:familyboard_mobile/kids/time_of_day.dart';
import 'package:familyboard_mobile/kids/undo_toast_controller.dart';
import 'package:familyboard_mobile/models/chore.dart';
import 'package:familyboard_mobile/models/mutations.dart';
import 'package:familyboard_mobile/services/chores_service.dart';
import 'package:familyboard_mobile/state/chores_provider.dart';
import 'package:familyboard_mobile/state/undo_toast_provider.dart';
import 'package:familyboard_mobile/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/kid_harness.dart';

Finder _pictoNamed(String name) =>
    find.byWidgetPredicate((Widget w) => w is KidPicto && w.name == name);

Finder _addButton() => find.byIcon(Icons.add_rounded);

/// A "manage" control is anything that adds a chore. The child session must
/// not have one anywhere in the tree: not offstage, not invisible, not even
/// as a bare semantics node (ruling R6.3: "auch keine unsichtbaren").
bool _isManageTarget(Widget w) =>
    w is KidRoundButton && w.semanticLabel.contains('hinzufügen');

void _expectNoManageTargets(WidgetTester tester) {
  expect(
    find.byWidgetPredicate(_isManageTarget, skipOffstage: false),
    findsNothing,
  );
  expect(find.byIcon(Icons.add_rounded, skipOffstage: false), findsNothing);
  expect(find.byType(FloatingActionButton, skipOffstage: false), findsNothing);
  expect(find.bySemanticsLabel(RegExp('hinzufügen')), findsNothing);
  expect(
    find.byWidgetPredicate(
      (Widget w) =>
          w is Semantics && (w.properties.label ?? '').contains('hinzufügen'),
      skipOffstage: false,
    ),
    findsNothing,
  );
}

void _phone(WidgetTester tester) {
  tester.view.devicePixelRatio = 3;
  tester.view.physicalSize = const Size(390, 1400) * 3;
  addTearDown(tester.view.reset);
}

List<Chore> _family() => <Chore>[
  ...sampleChores(),
  chore('l1', 'Hund füttern', '🐕', ChoreTimeOfDay.day, who: kChoreLeo),
  chore('x1', 'Müll rausbringen', '🗑️', null, who: null, points: 2),
];

Future<Harness> _pumpTasks(
  WidgetTester tester, {
  bool admin = false,
  List<Chore>? chores,
  Future<ChoresResult> Function()? load,
  bool dark = false,
}) async {
  _phone(tester);
  final Harness h = Harness(tester, admin: admin, chores: chores ?? _family());
  await tester.pumpWidget(
    h.app(
      const TasksScreen(),
      mode: dark ? ThemeMode.dark : ThemeMode.light,
      load: load,
    ),
  );
  await tester.pump();
  await tester.pump();
  return h;
}

void main() {
  group('R6.3 admin gating', () {
    testWidgets('a child session has no manage target in the tree at all', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await _pumpTasks(tester);

      _expectNoManageTargets(tester);
      handle.dispose();
    });

    testWidgets('the detector finds a hidden-but-present target (meta test)', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await tester.pumpWidget(
        MaterialApp(
          theme: FamilyBoardTheme.light(),
          home: Column(
            children: <Widget>[
              Offstage(
                child: KidRoundButton(
                  semanticLabel: 'Aufgabe hinzufügen',
                  onTap: () {},
                  child: const Icon(Icons.add_rounded),
                ),
              ),
              Visibility(
                visible: false,
                maintainState: true,
                child: Semantics(
                  label: 'Aufgabe hinzufügen',
                  child: const SizedBox(),
                ),
              ),
            ],
          ),
        ),
      );
      expect(
        find.byWidgetPredicate(_isManageTarget, skipOffstage: false),
        findsOneWidget,
      );
      expect(
        find.byIcon(Icons.add_rounded, skipOffstage: false),
        findsOneWidget,
      );
      handle.dispose();
    });

    testWidgets('an admin session gets the + on the board', (
      WidgetTester tester,
    ) async {
      await _pumpTasks(tester, admin: true);

      expect(_addButton(), findsOneWidget);
      expect(
        find.byWidgetPredicate(_isManageTarget, skipOffstage: false),
        findsOneWidget,
      );
    });

    testWidgets('the empty state shows relax and no + for a child', (
      WidgetTester tester,
    ) async {
      await _pumpTasks(
        tester,
        chores: <Chore>[chore('l1', 'x', null, null, who: kChoreLeo)],
      );
      expect(_pictoNamed('relax'), findsOneWidget);
      _expectNoManageTargets(tester);
    });

    testWidgets('the empty state offers + to admins', (
      WidgetTester tester,
    ) async {
      await _pumpTasks(
        tester,
        admin: true,
        chores: <Chore>[chore('l1', 'x', null, null, who: kChoreLeo)],
      );
      expect(_pictoNamed('relax'), findsOneWidget);
      expect(_addButton(), findsNWidgets(2));
    });

    testWidgets('Heute: the Ämtli card hides + from children', (
      WidgetTester tester,
    ) async {
      _phone(tester);
      final Harness h = Harness(tester, chores: _family());
      await tester.pumpWidget(
        h.app(
          const SingleChildScrollView(
            child: KidHomeChoresCard(session: kSession),
          ),
        ),
      );
      await tester.pump();
      await tester.pump();
      expect(find.text('Hausaufgaben'), findsOneWidget);
      _expectNoManageTargets(tester);
    });
  });

  group('A3: the session person is the only one who can tick', () {
    testWidgets('another person\'s board is shown but read-only', (
      WidgetTester tester,
    ) async {
      final Harness h = await _pumpTasks(tester);

      await tester.tap(find.text('Leo'));
      await tester.pump();
      await tester.pump();
      expect(find.text('Hund füttern'), findsOneWidget);
      expect(find.text('Aufgaben von Leo: nur ansehen'), findsOneWidget);

      await tester.tap(find.text('Hund füttern'));
      await advance(tester, 500);
      expect(h.mutations.completed, isEmpty);
      expect(
        tester
            .widget<KidChoreCard>(find.byType(KidChoreCard).first)
            .interactive,
        isFalse,
      );
    });

    testWidgets('"für alle" chores can be ticked by the session person', (
      WidgetTester tester,
    ) async {
      final Harness h = await _pumpTasks(tester);

      await tester.tap(find.text('Für alle'));
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('Müll rausbringen'));
      await advance(tester, 500);

      expect(h.mutations.completed, <String>['x1']);
      await advance(tester, 12000);
    });
  });

  group('R9 states', () {
    testWidgets('loading shows skeleton cards, never a 0', (
      WidgetTester tester,
    ) async {
      final Completer<ChoresResult> never = Completer<ChoresResult>();
      await _pumpTasks(tester, load: () => never.future);

      expect(find.byType(KidSkeletonCard), findsNWidgets(3));
      expect(find.text('0'), findsNothing);
      expect(find.byType(KidChoreCard), findsNothing);
    });

    testWidgets('a load error shows oops, a big retry and a short line', (
      WidgetTester tester,
    ) async {
      int calls = 0;
      await _pumpTasks(
        tester,
        load: () async {
          calls += 1;
          throw const ChoresFetchException('Network error: boom');
        },
      );

      expect(_pictoNamed('oops'), findsOneWidget);
      expect(find.text('Laden hat nicht geklappt.'), findsOneWidget);
      // Never the raw exception text.
      expect(find.textContaining('boom'), findsNothing);
      final int before = calls;
      await tester.tap(find.byIcon(Icons.refresh_rounded));
      await tester.pump();
      await tester.pump();
      expect(calls, greaterThan(before));
      final Size retry = tester.getSize(
        find.byIcon(Icons.refresh_rounded).first,
      );
      expect(retry.width, greaterThan(0));
    });

    testWidgets('a failed refresh keeps the stale data visible', (
      WidgetTester tester,
    ) async {
      int calls = 0;
      final Harness h = await _pumpTasks(
        tester,
        load: () async {
          calls += 1;
          if (calls > 1) {
            throw const ChoresFetchException('down');
          }
          return ChoresResult(chores: _family());
        },
      );
      expect(find.text('Hausaufgaben'), findsOneWidget);

      final ProviderContainer container = ProviderScope.containerOf(
        tester.element(find.byType(MaterialApp)),
      );
      container.invalidate(choresProvider);
      await tester.pump();
      await tester.pump();

      expect(find.text('Hausaufgaben'), findsOneWidget);
      expect(_pictoNamed('oops'), findsOneWidget);
      expect(h.mutations.completed, isEmpty);
    });

    testWidgets('dark theme builds without errors', (
      WidgetTester tester,
    ) async {
      await _pumpTasks(tester, dark: true);
      expect(find.text('Hausaufgaben'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('R9.4 semantics', () {
    testWidgets(
      'cards, avatars and the touch targets are labelled and big enough',
      (WidgetTester tester) async {
        final SemanticsHandle handle = tester.ensureSemantics();
        await _pumpTasks(tester, admin: true);

        expect(find.bySemanticsLabel('Hausaufgaben, 3 Sterne'), findsOneWidget);
        expect(find.bySemanticsLabel(RegExp('^Leo: 1 offen')), findsOneWidget);
        expect(
          find.bySemanticsLabel('Aufgabe für Mia hinzufügen'),
          findsOneWidget,
        );
        // Pictos next to text are decorative: no node carries a picto label.
        expect(find.bySemanticsLabel('Hausaufgaben'), findsNothing);

        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        handle.dispose();
      },
    );
  });

  group('optimistic chore actions', () {
    testWidgets(
      'a failed request puts the card back to open with retry and an oops toast',
      (WidgetTester tester) async {
        final Harness h = await _pumpTasks(tester);
        h.mutations.failWith = const MutationFetchException('500 boom');

        await tester.tap(find.text('Hausaufgaben'));
        await advance(tester, 700);

        KidChoreCard card() => tester.widget(
          find.byWidgetPredicate(
            (Widget w) => w is KidChoreCard && w.chore.id == 'c',
          ),
        );
        expect(card().view.failed, isTrue);
        expect(card().view.done, isFalse);
        // Toast: task picto + oops + a short localized line, never raw text.
        expect(_pictoNamed('oops'), findsWidgets);
        expect(
          find.text('Das hat nicht geklappt. Bitte nochmal versuchen.'),
          findsOneWidget,
        );
        expect(find.textContaining('boom'), findsNothing);

        // Retry from the card.
        h.mutations.failWith = null;
        await advance(tester, 700);
        await tester.tap(find.text('Hausaufgaben'));
        await advance(tester, 700);
        expect(card().view.done, isTrue);
        expect(h.mutations.completed, <String>['c', 'c']);
        await advance(tester, 12000);
      },
    );

    for (final bool dark in <bool>[false, true]) {
      testWidgets(
        'the card is dimmed while the request is sending (${dark ? 'dark' : 'light'})',
        (WidgetTester tester) async {
          final Harness h = await _pumpTasks(tester, dark: dark);
          h.mutations.gate = Completer<void>();

          expect(find.byKey(kKidCardSendingDimKey), findsNothing);
          await tester.tap(find.text('Hausaufgaben'));
          await advance(tester, 400);

          final DecoratedBox dim = tester.widget(
            find.byKey(kKidCardSendingDimKey),
          );
          final BoxDecoration deco = dim.decoration as BoxDecoration;
          final Color expected = (dark ? KidTokens.dark : KidTokens.light).bg;
          expect(deco.color!.a, greaterThan(0));
          expect(deco.color!.a, lessThan(1));
          expect(deco.color!.withValues(alpha: 1), expected);
          // Only the card that is sending is dimmed.
          expect(find.byKey(kKidCardSendingDimKey), findsOneWidget);

          h.mutations.gate!.complete();
          await advance(tester, 600);
          expect(find.byKey(kKidCardSendingDimKey), findsNothing);
          await advance(tester, 12000);
        },
      );
    }

    testWidgets('an undo asked for while the tick is in flight waits for it', (
      WidgetTester tester,
    ) async {
      final Harness h = await _pumpTasks(tester);
      h.mutations.gate = Completer<void>();

      await tester.tap(find.text('Hausaufgaben'));
      await advance(tester, 900);
      await tester.tap(_pictoNamed('undo'));
      await advance(tester, 200);
      // Still gated: the undo has not been sent before the tick finished.
      expect(h.mutations.completed, <String>['c']);
      expect(h.mutations.undone, isEmpty);

      h.mutations.gate!.complete();
      await advance(tester, 400);
      expect(h.mutations.undone, <String>['c']);
      expect(
        tester
            .widget<KidChoreCard>(
              find.byWidgetPredicate(
                (Widget w) => w is KidChoreCard && w.chore.id == 'c',
              ),
            )
            .view
            .done,
        isFalse,
      );
      await advance(tester, 12000);
    });

    testWidgets('a tap on a done card never ticks again', (
      WidgetTester tester,
    ) async {
      final Harness h = await _pumpTasks(
        tester,
        chores: <Chore>[
          chore('c', 'Hausaufgaben', '📚', ChoreTimeOfDay.day, done: true),
          chore('d', 'Hände waschen', '🧼', ChoreTimeOfDay.day),
        ],
      );

      await tester.tap(find.text('Hausaufgaben'));
      await advance(tester, 800);

      expect(h.mutations.completed, isEmpty);
      final ProviderContainer container = ProviderScope.containerOf(
        tester.element(find.byType(MaterialApp)),
      );
      final UndoToastController toasts = container.read(undoToastProvider);
      expect(toasts.entries.single.kind, UndoToastKind.revealed);
      await advance(tester, 6000);
    });
  });

  group('R3.3 create sheet', () {
    testWidgets(
      'stores the canonical emoji of the picked picto, never its name',
      (WidgetTester tester) async {
        _phone(tester);
        final Harness h = Harness(tester, admin: true);
        await tester.pumpWidget(
          h.app(
            const SingleChildScrollView(
              child: ChoreCreateSheet(initialMemberId: 'mia'),
            ),
          ),
        );
        await tester.pump();
        await tester.pump();

        await tester.enterText(find.byType(TextField), 'Schulaufgaben');
        await tester.pump();
        await tester.ensureVisible(_pictoNamed('teeth'));
        await tester.tap(_pictoNamed('teeth'));
        await tester.pump();
        await tester.ensureVisible(find.byType(FilledButton));
        await tester.tap(find.byType(FilledButton));
        await advance(tester, 300);

        expect(h.mutations.created, hasLength(1));
        expect(h.mutations.created.single['icon'], canonicalEmojiFor('teeth'));
        expect(h.mutations.created.single['icon'], '🪥');
        expect(h.mutations.created.single['memberId'], 'mia');
      },
    );
  });

  test('R7.4: no ß in any German string', () {
    final String de = File('lib/l10n/app_de.arb').readAsStringSync();
    expect(de.contains('ß'), isFalse);
  });
}
