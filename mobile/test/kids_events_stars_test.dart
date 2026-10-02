// R8 event grouping for Heute and the honest star counter (R6.2, A1 pending).

import 'package:familyboard_mobile/kids/event_groups.dart';
import 'package:familyboard_mobile/kids/points.dart';
import 'package:familyboard_mobile/models/chore.dart';
import 'package:familyboard_mobile/models/event.dart';
import 'package:flutter_test/flutter_test.dart';

const EventMember mia = EventMember(
  id: 'mia',
  name: 'Mia',
  color: 'lilac',
  emoji: '🦄',
);
const EventMember leo = EventMember(
  id: 'leo',
  name: 'Leo',
  color: 'teal',
  emoji: '🦖',
);

final DateTime now = DateTime(2026, 10, 2, 14, 30);

MobileEvent timed(
  String id,
  int fromH,
  int fromM,
  int toH,
  int toM, {
  EventMember who = mia,
}) => MobileEvent(
  id: id,
  title: id,
  description: null,
  location: null,
  startsAt: DateTime(2026, 10, 2, fromH, fromM),
  endsAt: DateTime(2026, 10, 2, toH, toM),
  allDay: false,
  color: null,
  source: 'LOCAL',
  member: who,
);

MobileEvent allDay(String id, DateTime day, {int days = 1}) => MobileEvent(
  id: id,
  title: id,
  description: null,
  location: null,
  startsAt: DateTime.utc(day.year, day.month, day.day),
  endsAt: DateTime.utc(day.year, day.month, day.day + days),
  allDay: true,
  color: null,
  source: 'LOCAL',
  member: leo,
);

List<String> ids(EventBandGroup g) =>
    g.entries.map((TodayEventEntry e) => e.event.id).toList();

void main() {
  group('groupTodaysEvents (R8.2)', () {
    test('all-day on top, then Morgens / Tagsüber / Abends', () {
      final List<EventBandGroup> groups = groupTodaysEvents(<MobileEvent>[
        timed('evening', 18, 0, 19, 0),
        timed('morning', 8, 0, 9, 0),
        allDay('birthday', DateTime(2026, 10, 2)),
        timed('day', 13, 0, 15, 0),
      ], now);

      expect(groups.map((EventBandGroup g) => g.band), <EventBand>[
        EventBand.allDay,
        EventBand.morning,
        EventBand.day,
        EventBand.evening,
      ]);
      expect(ids(groups.first), <String>['birthday']);
    });

    test('past events are flagged, the running one is current', () {
      final List<EventBandGroup> groups = groupTodaysEvents(<MobileEvent>[
        timed('over', 8, 0, 9, 0),
        timed('running', 14, 0, 15, 30),
        timed('later', 16, 0, 17, 0),
      ], now);
      final Map<String, TodayEventEntry> byId = <String, TodayEventEntry>{
        for (final EventBandGroup g in groups)
          for (final TodayEventEntry e in g.entries) e.event.id: e,
      };

      expect(byId['over']!.past, isTrue);
      expect(byId['over']!.current, isFalse);
      expect(byId['running']!.current, isTrue);
      expect(byId['running']!.past, isFalse);
      expect(byId['later']!.past, isFalse);
      expect(byId['later']!.current, isFalse);
    });

    test('an event ending exactly now is over, not running', () {
      final List<EventBandGroup> groups = groupTodaysEvents(<MobileEvent>[
        timed('edge', 14, 0, 14, 30),
      ], now);
      expect(groups.single.entries.single.past, isTrue);
      expect(groups.single.entries.single.current, isFalse);
    });

    test('events between midnight and 05:00 read as early morning', () {
      expect(bandOfStart(DateTime(2026, 10, 2, 3, 0)), EventBand.morning);
      expect(bandOfStart(DateTime(2026, 10, 2, 5, 0)), EventBand.morning);
      expect(bandOfStart(DateTime(2026, 10, 2, 11, 0)), EventBand.day);
      expect(bandOfStart(DateTime(2026, 10, 2, 17, 0)), EventBand.evening);
    });

    test('yesterday\'s and tomorrow\'s all-day events do not show', () {
      final List<EventBandGroup> groups = groupTodaysEvents(<MobileEvent>[
        allDay('yesterday', DateTime(2026, 10, 1)),
        allDay('tomorrow', DateTime(2026, 10, 3)),
        allDay('trip', DateTime(2026, 10, 1), days: 3),
      ], now);
      expect(
        groups.single.entries.map((TodayEventEntry e) => e.event.id),
        <String>['trip'],
      );
    });

    test('person filter keeps only that person (R8.3)', () {
      final List<MobileEvent> events = <MobileEvent>[
        timed('a', 8, 0, 9, 0),
        timed('b', 9, 0, 10, 0, who: leo),
      ];
      expect(
        groupTodaysEvents(
          events,
          now,
          memberId: 'leo',
        ).single.entries.single.event.id,
        'b',
      );
      expect(groupTodaysEvents(events, now).single.entries, hasLength(2));
      expect(groupTodaysEvents(events, now, memberId: 'nobody'), isEmpty);
    });
  });

  group('starsEarnedToday (honest placeholder for the balance)', () {
    Chore chore(String id, int points, {String? by}) => Chore(
      id: id,
      title: id,
      icon: null,
      points: points,
      rrule: null,
      memberId: 'mia',
      member: null,
      completedToday: by != null,
      completedTodayBy: by == null
          ? null
          : ChoreMember(id: by, name: by, color: 'sky', emoji: ''),
    );

    test('sums the points a person finished today, nothing else', () {
      final List<Chore> chores = <Chore>[
        chore('a', 3, by: 'mia'),
        chore('b', 2, by: 'mia'),
        chore('c', 5, by: 'leo'),
        chore('d', 4),
      ];
      int stars(String who) => starsEarnedToday(
        memberId: who,
        chores: chores,
        isDone: (Chore c) => c.completedToday,
        doerOf: (Chore c) => c.completedTodayBy?.id,
      );

      expect(stars('mia'), 5);
      expect(stars('leo'), 5);
      expect(stars('nobody'), 0);
    });

    test('the optimistic answer counts at once', () {
      final Chore open = chore('a', 3);
      expect(
        starsEarnedToday(
          memberId: 'mia',
          chores: <Chore>[open],
          isDone: (Chore c) => true,
          doerOf: (Chore c) => 'mia',
        ),
        3,
      );
    });
  });
}
