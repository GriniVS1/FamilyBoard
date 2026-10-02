// Widget tests of the chore board (R4-R5): phase grouping, the Doppeltipp
// acceptance test, the undo arm delay, toast windows, tap locks and layout
// stillness - all against a mocked mutations service and a clock driven by
// the test binding.

import 'package:familyboard_mobile/kids/kid_chore_card.dart';
import 'package:familyboard_mobile/kids/kid_chore_section.dart';
import 'package:familyboard_mobile/kids/time_of_day.dart';
import 'package:familyboard_mobile/models/chore.dart';
import 'package:familyboard_mobile/state/kid_clock_provider.dart';
import 'package:familyboard_mobile/kids/kid_stars.dart';
import 'package:familyboard_mobile/kids/picto.dart';
import 'package:familyboard_mobile/state/chores_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/kid_harness.dart';

Future<Harness> _pumpBoard(WidgetTester tester, {bool reduced = false}) async {
  tester.view.devicePixelRatio = 3;
  tester.view.physicalSize = const Size(390, 1400) * 3;
  addTearDown(tester.view.reset);
  final Harness h = Harness(tester);
  await tester.pumpWidget(h.app(h.miaBoard(), reduced: reduced));
  await tester.pump();
  await tester.pump();
  return h;
}

double _top(WidgetTester tester, String title) =>
    tester.getTopLeft(find.text(title)).dy;

void main() {
  group('R4 grouping by day phase', () {
    testWidgets('current phase and Jederzeit are open, Morgens is a chip row', (
      WidgetTester tester,
    ) async {
      await _pumpBoard(tester);

      // Tagsüber (now: 14:30) and Jederzeit show full cards.
      expect(find.text('Hausaufgaben'), findsOneWidget);
      expect(find.text('Hände waschen'), findsOneWidget);
      expect(find.text('Wasser trinken'), findsOneWidget);
      // Morgens is collapsed: no cards, only the chip row.
      expect(find.text('Zähne putzen'), findsNothing);
      expect(find.text('Bett machen'), findsNothing);
      expect(find.byType(KidChoreCard), findsNWidgets(4));
      expect(
        find.byWidgetPredicate(
          (Widget w) => w is KidPicto && w.name == 'tod-morning',
        ),
        findsOneWidget,
      );
      // Group order: Tagsüber before Jederzeit.
      expect(
        _top(tester, 'Hausaufgaben') < _top(tester, 'Wasser trinken'),
        isTrue,
      );
    });

    testWidgets('a tap on the collapsed Morgens row opens it', (
      WidgetTester tester,
    ) async {
      await _pumpBoard(tester);

      await tester.tap(
        find.byWidgetPredicate(
          (Widget w) => w is KidPicto && w.name == 'tod-morning',
        ),
      );
      await tester.pump();

      expect(find.text('Zähne putzen'), findsOneWidget);
      expect(find.text('Bett machen'), findsOneWidget);
      expect(
        _top(tester, 'Zähne putzen') < _top(tester, 'Hausaufgaben'),
        isTrue,
      );
    });

    testWidgets('cards are at least 80 high and equally high in a group', (
      WidgetTester tester,
    ) async {
      await _pumpBoard(tester);

      final List<double> heights = <double>[
        for (final Element e in find.byType(KidChoreCard).evaluate())
          (e.renderObject! as RenderBox).size.height,
      ];
      expect(heights, isNotEmpty);
      expect(heights.every((double h) => h >= 80), isTrue);
      expect(heights.toSet(), hasLength(1));
    });

    testWidgets('exactly one card is "next": the first open of the phase', (
      WidgetTester tester,
    ) async {
      await _pumpBoard(tester);

      expect(
        find.byWidgetPredicate((Widget w) => w is KidChoreCard && w.view.next),
        findsOneWidget,
      );
      final KidChoreCard next = tester.widget(
        find.byWidgetPredicate((Widget w) => w is KidChoreCard && w.view.next),
      );
      expect(next.chore.id, 'c');
    });
  });

  group('Doppeltipp acceptance (ruling: Abnahme)', () {
    for (final int gapMs in <int>[300, 800]) {
      testWidgets(
        'double tap after $gapMs ms: exactly 1 completion, no undo, no foreign task',
        (WidgetTester tester) async {
          final Harness h = await _pumpBoard(tester);
          h.mutations.delay = const Duration(milliseconds: 150);

          final Finder card = cardTitle('Hausaufgaben');
          await tester.tap(card);
          await advance(tester, gapMs);
          await tester.tap(card);
          // Let the request, the toast and the quiet period play out.
          await advance(tester, 12000);

          expect(h.mutations.completed, <String>['c']);
          expect(h.mutations.undone, isEmpty);
          // The card ended up done, not toggled back.
          final KidChoreCard c = tester.widget(
            find.byWidgetPredicate(
              (Widget w) => w is KidChoreCard && w.chore.id == 'c',
            ),
          );
          expect(c.view.done, isTrue);
          // No other task was touched.
          expect(
            h.server.where((c) => c.completedToday).map((c) => c.id),
            <String>['c'],
          );
        },
      );
    }

    testWidgets(
      'the second tap of a double tap never fires the undo of the toast',
      (WidgetTester tester) async {
        final Harness h = await _pumpBoard(tester);

        await tester.tap(cardTitle('Hausaufgaben'));
        await advance(tester, 700);
        // Armed by now - a second tap on the card is still not an undo.
        await tester.tap(cardTitle('Hausaufgaben'));
        await advance(tester, 100);

        expect(h.mutations.undone, isEmpty);
        expect(h.mutations.completed, <String>['c']);
        await advance(tester, 12000);
      },
    );
  });

  group('R5.3 undo toast', () {
    testWidgets('the undo button is inert and invisible for 600 ms', (
      WidgetTester tester,
    ) async {
      final Harness h = await _pumpBoard(tester);
      await tester.tap(cardTitle('Hausaufgaben'));
      await advance(tester, 100);

      expect(undoPicto(), findsOneWidget);
      // 599 ms after the toast appeared: a tap on the arrow does nothing.
      await advance(tester, 450);
      await tester.tap(undoPicto(), warnIfMissed: false);
      await advance(tester, 20);
      expect(h.mutations.undone, isEmpty);

      // 600 ms: armed.
      await advance(tester, 100);
      await tester.tap(undoPicto());
      await advance(tester, 400);
      expect(h.mutations.undone, <String>['c']);
      expect(h.mutations.completed, <String>['c']);
      await advance(tester, 12000);
    });

    testWidgets('a fresh tick keeps its window for 8 s', (
      WidgetTester tester,
    ) async {
      await _pumpBoard(tester);
      await tester.tap(cardTitle('Hausaufgaben'));
      await advance(tester, 7800);
      expect(undoPicto(), findsOneWidget);

      await advance(tester, 400);
      expect(undoPicto(), findsNothing);
    });

    testWidgets('a tap on an older done card opens a 5 s window, no new tick', (
      WidgetTester tester,
    ) async {
      final Harness h = await _pumpBoard(tester);
      h.server = <Chore>[
        for (final Chore c in h.server)
          if (c.id == 'c')
            chore(
              'c',
              'Hausaufgaben',
              '📚',
              ChoreTimeOfDay.day,
              points: 3,
              done: true,
            )
          else
            c,
      ];
      final ProviderContainer container = ProviderScope.containerOf(
        tester.element(find.byType(MaterialApp)),
      );
      container.invalidate(choresProvider);
      await tester.pump();
      await tester.pump();
      await advance(tester, 4000);

      await tester.tap(cardTitle('Hausaufgaben'));
      await advance(tester, 4800);
      expect(undoPicto(), findsOneWidget);
      await advance(tester, 400);
      expect(undoPicto(), findsNothing);
      expect(h.mutations.completed, isEmpty);
    });

    testWidgets('with reduced motion no stars fly and the end state is shown', (
      WidgetTester tester,
    ) async {
      final Harness h = await _pumpBoard(tester, reduced: true);
      final BuildContext context = tester.element(find.byType(KidChoreSection));
      expect(
        KidStarFlight.play(
          context,
          from: Offset.zero,
          target: GlobalKey(),
          stars: 3,
        ),
        isFalse,
      );

      await tester.tap(cardTitle('Hausaufgaben'));
      await advance(tester, 700);
      final KidChoreCard c = tester.widget(
        find.byWidgetPredicate(
          (Widget w) => w is KidChoreCard && w.chore.id == 'c',
        ),
      );
      expect(c.view.done, isTrue);
      expect(h.mutations.completed, <String>['c']);
      await advance(tester, 12000);
    });
  });

  group('R5.5 tap locks', () {
    testWidgets(
      'another card of the same list is locked for 600 ms after a tick',
      (WidgetTester tester) async {
        final Harness h = await _pumpBoard(tester);

        await tester.tap(cardTitle('Hausaufgaben'));
        await advance(tester, 300);
        await tester.tap(cardTitle('Hände waschen'));
        await advance(tester, 100);
        // The locked tap sprang but did nothing.
        expect(h.mutations.completed, <String>['c']);

        await advance(tester, 300);
        await tester.tap(cardTitle('Hände waschen'));
        await advance(tester, 100);
        expect(h.mutations.completed, <String>['c', 'd']);
        await advance(tester, 12000);
      },
    );

    testWidgets('a scroll leaves taps unreliable for 300 ms', (
      WidgetTester tester,
    ) async {
      final Harness h = await _pumpBoard(tester);
      final ProviderContainer container = ProviderScope.containerOf(
        tester.element(find.byType(MaterialApp)),
      );
      container.read(tapGuardProvider).recordScroll('test');

      await advance(tester, 200);
      await tester.tap(cardTitle('Hausaufgaben'));
      await advance(tester, 50);
      expect(h.mutations.completed, isEmpty);

      await advance(tester, 100);
      await tester.tap(cardTitle('Hausaufgaben'));
      await advance(tester, 50);
      expect(h.mutations.completed, <String>['c']);
      await advance(tester, 12000);
    });
  });

  group('R5.4 layout stillness', () {
    testWidgets(
      'nothing moves under the finger; resort only after 3 s untouched and the undo window closed',
      (WidgetTester tester) async {
        final Harness h = await _pumpBoard(tester);
        // Make "Hausaufgaben" and its two siblings plain open cards.
        final double before = _top(tester, 'Hausaufgaben');
        final double siblingBefore = _top(tester, 'Hände waschen');

        await tester.tap(cardTitle('Hausaufgaben'));
        await advance(tester, 4000);
        // Window still open: the done card stays exactly where it was.
        expect(_top(tester, 'Hausaufgaben'), before);
        expect(_top(tester, 'Hände waschen'), siblingBefore);

        await advance(tester, 3800);
        expect(_top(tester, 'Hausaufgaben'), before);

        // Window closed at 8 s and the list untouched for > 3 s: resort.
        await advance(tester, 1500);
        expect(
          _top(tester, 'Hausaufgaben') > _top(tester, 'Hände waschen'),
          isTrue,
        );
        expect(h.mutations.completed, <String>['c']);
      },
    );

    testWidgets('"next" jumps at once without moving any card', (
      WidgetTester tester,
    ) async {
      await _pumpBoard(tester);
      final double firstTop = _top(tester, 'Hausaufgaben');

      await tester.tap(cardTitle('Hausaufgaben'));
      await advance(tester, 700);

      KidChoreCard card(String id) => tester.widget(
        find.byWidgetPredicate(
          (Widget w) => w is KidChoreCard && w.chore.id == id,
        ),
      );
      expect(card('d').view.next, isTrue);
      expect(card('c').view.next, isFalse);
      expect(_top(tester, 'Hausaufgaben'), firstTop);
      await advance(tester, 12000);
    });

    testWidgets(
      'two or more done fold into a strip of mini pictos at the group end',
      (WidgetTester tester) async {
        final Harness h = await _pumpBoard(tester);

        await tester.tap(cardTitle('Hausaufgaben'));
        await advance(tester, 700);
        await tester.tap(cardTitle('Hände waschen'));
        await advance(tester, 12000);

        expect(h.mutations.completed, <String>['c', 'd']);
        // Folded: the two titles are gone, their minis remain.
        expect(find.text('Hausaufgaben'), findsNothing);
        expect(find.text('Hände waschen'), findsNothing);
        expect(find.byType(KidDoneMini), findsNWidgets(2));
        expect(find.text('Musik üben'), findsOneWidget);
      },
    );
  });
}
