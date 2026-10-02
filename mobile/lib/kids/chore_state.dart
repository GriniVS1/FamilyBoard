/// Port of `src/lib/chore-state.ts` (R4.4, R4.5): which chore is "next" for a
/// person, the column state, and the grouping by day phase. Pure: no widgets,
/// no providers; pass `now` in.
library;

import 'time_of_day.dart';

/// What the state functions need from a chore. `Chore` implements it.
abstract interface class ChoreLike {
  String get id;
  String? get memberId;
  ChoreTimeOfDay? get timeOfDay;
  int get points;
}

/// A completion of a chore today. Any member's completion counts the chore as
/// done (the wall lets anyone finish an unassigned chore).
abstract interface class CompletionLike {
  String get choreId;
  String? get memberId;
}

class Completion implements CompletionLike {
  const Completion({required this.choreId, this.memberId});

  @override
  final String choreId;
  @override
  final String? memberId;
}

enum ChoreStatus { open, next, done }

/// Order inside a group: next, then open, then done.
const List<ChoreStatus> kStatusRank = <ChoreStatus>[
  ChoreStatus.next,
  ChoreStatus.open,
  ChoreStatus.done,
];

/// `anytime` is the group for chores without a `timeOfDay`.
enum PhaseGroupKey { morning, day, evening, anytime }

const List<PhaseGroupKey> kGroupOrder = <PhaseGroupKey>[
  PhaseGroupKey.morning,
  PhaseGroupKey.day,
  PhaseGroupKey.evening,
  PhaseGroupKey.anytime,
];

/// - [empty]: the person has no chores at all (never celebrate that).
/// - [allDone]: chores exist and every one is done today (`celebrate`).
/// - [night]: nothing is offered between 00:00 and 04:59 (`tod-night`).
/// - [pause]: open chores exist, but only for phases that have not started yet.
enum ColumnState { empty, allDone, pause, night, active }

class ChoreEntry<T extends ChoreLike> {
  const ChoreEntry({required this.chore, required this.status});

  final T chore;
  final ChoreStatus status;
}

class ChoreGroup<T extends ChoreLike> {
  const ChoreGroup({
    required this.key,
    required this.entries,
    required this.done,
    required this.total,
  });

  final PhaseGroupKey key;
  final List<ChoreEntry<T>> entries;
  final int done;
  final int total;
}

class ColumnSummary<T extends ChoreLike> {
  const ColumnSummary({
    required this.state,
    required this.next,
    required this.upcomingPhase,
    required this.done,
    required this.total,
    required this.open,
  });

  final ColumnState state;
  final T? next;

  /// Earliest phase that still has open chores; drives the dimmed picto of
  /// [ColumnState.pause].
  final ChoreTimeOfDay? upcomingPhase;
  final int done;
  final int total;
  final int open;
}

PhaseGroupKey groupKeyOf(ChoreLike chore) => switch (chore.timeOfDay) {
  ChoreTimeOfDay.morning => PhaseGroupKey.morning,
  ChoreTimeOfDay.day => PhaseGroupKey.day,
  ChoreTimeOfDay.evening => PhaseGroupKey.evening,
  null => PhaseGroupKey.anytime,
};

Set<String> doneChoreIds(Iterable<CompletionLike> completions) => <String>{
  for (final CompletionLike c in completions) c.choreId,
};

bool isChoreDone(String choreId, Iterable<CompletionLike> completions) =>
    completions.any((CompletionLike c) => c.choreId == choreId);

/// Who did a "for everyone" chore today (the latest completion wins).
CompletionLike? completionFor(
  String choreId,
  Iterable<CompletionLike> completions,
) {
  CompletionLike? found;
  for (final CompletionLike c in completions) {
    if (c.choreId == choreId) {
      found = c;
    }
  }
  return found;
}

List<T> choresOf<T extends ChoreLike>(String? memberId, Iterable<T> chores) =>
    chores.where((T c) => c.memberId == memberId).toList();

/// The one chore a person should do now (UX 2.1): current phase first, then
/// "anytime", then catching up on earlier phases (most recent first). Never
/// during the night, never for unassigned ("for everyone") chores.
///
/// The base set is the person's open chores in the order given (API order).
T? nextChoreFor<T extends ChoreLike>(
  String memberId,
  Iterable<T> chores,
  Iterable<CompletionLike> completions,
  DateTime now,
) {
  final DayPhase phase = phaseOf(now);
  final ChoreTimeOfDay? current = phase.timeOfDay;
  if (current == null) {
    return null;
  }

  final Set<String> done = doneChoreIds(completions);
  final List<T> open = chores
      .where((T c) => c.memberId == memberId && !done.contains(c.id))
      .toList();

  for (final T c in open) {
    if (c.timeOfDay == current) {
      return c;
    }
  }
  for (final T c in open) {
    if (c.timeOfDay == null) {
      return c;
    }
  }
  for (final ChoreTimeOfDay earlier in earlierPhases(phase)) {
    for (final T c in open) {
      if (c.timeOfDay == earlier) {
        return c;
      }
    }
  }
  return null;
}

({int done, int total}) dayProgress<T extends ChoreLike>(
  String memberId,
  Iterable<T> chores,
  Iterable<CompletionLike> completions,
) {
  final Set<String> done = doneChoreIds(completions);
  final List<T> own = chores.where((T c) => c.memberId == memberId).toList();
  return (
    done: own.where((T c) => done.contains(c.id)).length,
    total: own.length,
  );
}

ColumnSummary<T> columnSummary<T extends ChoreLike>(
  String memberId,
  Iterable<T> chores,
  Iterable<CompletionLike> completions,
  DateTime now,
) {
  final ({int done, int total}) progress = dayProgress(
    memberId,
    chores,
    completions,
  );
  final int done = progress.done;
  final int total = progress.total;
  final int open = total - done;
  final DayPhase phase = phaseOf(now);

  final Set<String> doneIds = doneChoreIds(completions);
  final List<T> openChores = chores
      .where((T c) => c.memberId == memberId && !doneIds.contains(c.id))
      .toList();
  ChoreTimeOfDay? upcomingPhase;
  for (final ChoreTimeOfDay p in kPhaseOrder) {
    if (openChores.any((T c) => c.timeOfDay == p)) {
      upcomingPhase = p;
      break;
    }
  }

  if (total == 0) {
    return ColumnSummary<T>(
      state: ColumnState.empty,
      next: null,
      upcomingPhase: null,
      done: done,
      total: total,
      open: open,
    );
  }
  if (open == 0) {
    return ColumnSummary<T>(
      state: ColumnState.allDone,
      next: null,
      upcomingPhase: null,
      done: done,
      total: total,
      open: open,
    );
  }
  if (phase == DayPhase.night) {
    return ColumnSummary<T>(
      state: ColumnState.night,
      next: null,
      upcomingPhase: upcomingPhase,
      done: done,
      total: total,
      open: open,
    );
  }

  final T? next = nextChoreFor(memberId, chores, completions, now);
  return ColumnSummary<T>(
    state: next != null ? ColumnState.active : ColumnState.pause,
    next: next,
    upcomingPhase: upcomingPhase,
    done: done,
    total: total,
    open: open,
  );
}

/// Groups in fixed order (morning, day, evening, anytime), empty groups
/// dropped. Inside a group: next first, then open, then done, each in API
/// order (three stable passes; Dart's `List.sort` is not stable).
List<ChoreGroup<T>> groupByPhase<T extends ChoreLike>(
  Iterable<T> chores,
  Iterable<CompletionLike> completions,
  String? nextId,
) {
  final Set<String> doneIds = doneChoreIds(completions);
  final List<ChoreGroup<T>> groups = <ChoreGroup<T>>[];

  for (final PhaseGroupKey key in kGroupOrder) {
    final List<T> inGroup = chores
        .where((T c) => groupKeyOf(c) == key)
        .toList();
    if (inGroup.isEmpty) {
      continue;
    }

    ChoreStatus statusOf(T chore) {
      if (doneIds.contains(chore.id)) {
        return ChoreStatus.done;
      }
      return chore.id == nextId ? ChoreStatus.next : ChoreStatus.open;
    }

    final List<ChoreEntry<T>> all = <ChoreEntry<T>>[
      for (final T chore in inGroup)
        ChoreEntry<T>(chore: chore, status: statusOf(chore)),
    ];
    final List<ChoreEntry<T>> entries = <ChoreEntry<T>>[
      for (final ChoreStatus status in kStatusRank)
        ...all.where((ChoreEntry<T> e) => e.status == status),
    ];

    groups.add(
      ChoreGroup<T>(
        key: key,
        entries: entries,
        done: entries
            .where((ChoreEntry<T> e) => e.status == ChoreStatus.done)
            .length,
        total: entries.length,
      ),
    );
  }
  return groups;
}

/// Open by default: the running phase, "anytime", and whichever group holds
/// the "next" chore; otherwise a catch-up chore would hide in a collapsed
/// group.
Set<PhaseGroupKey> expandedGroupKeys(DayPhase phase, ChoreLike? next) {
  final Set<PhaseGroupKey> keys = <PhaseGroupKey>{PhaseGroupKey.anytime};
  switch (phase) {
    case DayPhase.morning:
      keys.add(PhaseGroupKey.morning);
    case DayPhase.day:
      keys.add(PhaseGroupKey.day);
    case DayPhase.evening:
      keys.add(PhaseGroupKey.evening);
    case DayPhase.night:
      break;
  }
  if (next != null) {
    keys.add(groupKeyOf(next));
  }
  return keys;
}
