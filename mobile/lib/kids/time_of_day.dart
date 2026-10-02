/// Port of `src/lib/time-of-day.ts` (R4.4): the four day phases that group
/// chores. Phases follow the device's local wall-clock time.
library;

/// Source of "now". Inject a fixed one in tests.
typedef Clock = DateTime Function();

/// The API values of `Chore.timeOfDay` (`MORNING` / `DAY` / `EVENING`).
enum ChoreTimeOfDay {
  morning('MORNING'),
  day('DAY'),
  evening('EVENING');

  const ChoreTimeOfDay(this.apiValue);

  final String apiValue;

  /// Null for null or an unknown value, which the wall treats as "anytime".
  static ChoreTimeOfDay? tryParse(Object? raw) {
    if (raw is! String) {
      return null;
    }
    for (final ChoreTimeOfDay value in ChoreTimeOfDay.values) {
      if (value.apiValue == raw) {
        return value;
      }
    }
    return null;
  }
}

/// A chore time of day or the night, when nothing is offered.
enum DayPhase {
  morning,
  day,
  evening,
  night;

  /// The matching chore time of day; null at night.
  ChoreTimeOfDay? get timeOfDay => switch (this) {
    DayPhase.morning => ChoreTimeOfDay.morning,
    DayPhase.day => ChoreTimeOfDay.day,
    DayPhase.evening => ChoreTimeOfDay.evening,
    DayPhase.night => null,
  };
}

/// Local hour at which each phase starts. NIGHT runs 00:00-04:59.
const Map<ChoreTimeOfDay, int> kPhaseStartHour = <ChoreTimeOfDay, int>{
  ChoreTimeOfDay.morning: 5,
  ChoreTimeOfDay.day: 11,
  ChoreTimeOfDay.evening: 17,
};

/// Display and grouping order; "anytime" is rendered after these.
const List<ChoreTimeOfDay> kPhaseOrder = <ChoreTimeOfDay>[
  ChoreTimeOfDay.morning,
  ChoreTimeOfDay.day,
  ChoreTimeOfDay.evening,
];

DayPhase phaseOf(DateTime now) {
  final int h = now.hour;
  if (h < kPhaseStartHour[ChoreTimeOfDay.morning]!) {
    return DayPhase.night;
  }
  if (h < kPhaseStartHour[ChoreTimeOfDay.day]!) {
    return DayPhase.morning;
  }
  if (h < kPhaseStartHour[ChoreTimeOfDay.evening]!) {
    return DayPhase.day;
  }
  return DayPhase.evening;
}

/// Phase right now according to [clock].
DayPhase currentPhase(Clock clock) => phaseOf(clock());

/// Phases that already ended today, most recent first (evening, day, morning).
List<ChoreTimeOfDay> earlierPhases(DayPhase phase) {
  final ChoreTimeOfDay? current = phase.timeOfDay;
  if (current == null) {
    return const <ChoreTimeOfDay>[];
  }
  return kPhaseOrder.sublist(0, kPhaseOrder.indexOf(current)).reversed.toList();
}

List<ChoreTimeOfDay> laterPhases(DayPhase phase) {
  final ChoreTimeOfDay? current = phase.timeOfDay;
  if (current == null) {
    return List<ChoreTimeOfDay>.of(kPhaseOrder);
  }
  return kPhaseOrder.sublist(kPhaseOrder.indexOf(current) + 1);
}
