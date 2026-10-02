/// Today's events grouped for Heute (R8.2), port of the wall's
/// `widget-today.tsx`: all-day on top, then Morgens / Tagsüber / Abends.
/// Pure: pass `now` in.
library;

import '../models/event.dart';
import 'time_of_day.dart';

/// All-day events come first; the rest sit in a day band.
enum EventBand { allDay, morning, day, evening }

class TodayEventEntry {
  const TodayEventEntry({
    required this.event,
    required this.start,
    required this.end,
    required this.past,
    required this.current,
  });

  final MobileEvent event;

  /// Start clamped to the beginning of the day.
  final DateTime start;
  final DateTime end;

  /// A timed event that already ended.
  final bool past;

  /// A timed event that is running right now.
  final bool current;
}

class EventBandGroup {
  const EventBandGroup({required this.band, required this.entries});

  final EventBand band;
  final List<TodayEventEntry> entries;
}

/// Events between midnight and 05:00 read as early morning, not a fourth band.
EventBand bandOfStart(DateTime start) => switch (phaseOf(start)) {
  DayPhase.morning || DayPhase.night => EventBand.morning,
  DayPhase.day => EventBand.day,
  DayPhase.evening => EventBand.evening,
};

/// Everything that touches the local day of [now], grouped. Events spanning
/// the whole day count as all-day. [memberId] keeps one person's events only
/// (R8.3).
List<EventBandGroup> groupTodaysEvents(
  Iterable<MobileEvent> events,
  DateTime now, {
  String? memberId,
}) {
  final DateTime dayStart = DateTime(now.year, now.month, now.day);
  final DateTime dayEnd = dayStart.add(const Duration(days: 1));

  final List<TodayEventEntry> allDay = <TodayEventEntry>[];
  final List<TodayEventEntry> timed = <TodayEventEntry>[];

  for (final MobileEvent event in events) {
    if (memberId != null && event.member.id != memberId) {
      continue;
    }
    final DateTime? rawStart = event.startsAt?.toLocal();
    final DateTime? rawEnd = event.endsAt?.toLocal();
    if (rawStart == null) {
      allDay.add(
        TodayEventEntry(
          event: event,
          start: dayStart,
          end: dayEnd,
          past: false,
          current: false,
        ),
      );
      continue;
    }
    final DateTime end = rawEnd ?? rawStart;
    if (event.allDay) {
      // All-day events are dates, not instants: compare local calendar days
      // (the end date is exclusive), the way the rest of the app groups them.
      final DateTime firstDay = event.groupDay;
      final DateTime endDay = DateTime(end.year, end.month, end.day);
      final DateTime lastExclusive = endDay.isAfter(firstDay)
          ? endDay
          : firstDay.add(const Duration(days: 1));
      if (!firstDay.isAfter(dayStart) && lastExclusive.isAfter(dayStart)) {
        allDay.add(
          TodayEventEntry(
            event: event,
            start: dayStart,
            end: dayEnd,
            past: false,
            current: false,
          ),
        );
      }
      continue;
    }
    final bool inDay = end == rawStart
        ? !rawStart.isBefore(dayStart) && rawStart.isBefore(dayEnd)
        : rawStart.isBefore(dayEnd) && end.isAfter(dayStart);
    if (!inDay) {
      continue;
    }
    final bool wholeDay = !rawStart.isAfter(dayStart) && !end.isBefore(dayEnd);
    if (wholeDay) {
      allDay.add(
        TodayEventEntry(
          event: event,
          start: rawStart,
          end: end,
          past: false,
          current: false,
        ),
      );
      continue;
    }
    timed.add(
      TodayEventEntry(
        event: event,
        start: rawStart.isBefore(dayStart) ? dayStart : rawStart,
        end: end,
        past: !end.isAfter(now),
        current: !rawStart.isAfter(now) && end.isAfter(now),
      ),
    );
  }
  timed.sort(
    (TodayEventEntry a, TodayEventEntry b) => a.start.compareTo(b.start),
  );

  final List<EventBandGroup> groups = <EventBandGroup>[];
  if (allDay.isNotEmpty) {
    groups.add(EventBandGroup(band: EventBand.allDay, entries: allDay));
  }
  for (final EventBand band in const <EventBand>[
    EventBand.morning,
    EventBand.day,
    EventBand.evening,
  ]) {
    final List<TodayEventEntry> inBand = timed
        .where((TodayEventEntry e) => bandOfStart(e.start) == band)
        .toList();
    if (inBand.isNotEmpty) {
      groups.add(EventBandGroup(band: band, entries: inBand));
    }
  }
  return groups;
}
