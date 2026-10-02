import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../kids/undo_toast_controller.dart';
import '../models/chore.dart';
import '../models/mutations.dart';
import '../models/session.dart';
import '../services/chores_service.dart';
import 'chores_provider.dart';
import 'session_provider.dart';
import 'undo_toast_provider.dart';

typedef _Who = ({String name, String color, String emoji});

/// What the UI should assume about one chore until the server confirms it.
class ChoreOverlay {
  const ChoreOverlay({
    required this.done,
    this.inflight = 0,
    this.queued = false,
    this.failed = false,
  });

  /// The state the person asked for.
  final bool done;

  /// Requests (complete / undo) not answered yet.
  final int inflight;

  /// The completion sits in the offline write queue.
  final bool queued;

  /// The last attempt failed; the card shows oops and ↻.
  final bool failed;

  bool get sending => inflight > 0;

  ChoreOverlay copyWith({
    bool? done,
    int? inflight,
    bool? queued,
    bool? failed,
  }) => ChoreOverlay(
    done: done ?? this.done,
    inflight: inflight ?? this.inflight,
    queued: queued ?? this.queued,
    failed: failed ?? this.failed,
  );
}

class ChoreActionsState {
  const ChoreActionsState([this.byChore = const <String, ChoreOverlay>{}]);

  final Map<String, ChoreOverlay> byChore;

  ChoreOverlay? operator [](String choreId) => byChore[choreId];

  /// Whether [chore] counts as done right now: the optimistic answer wins
  /// over the last fetched one.
  bool isDone(Chore chore) => byChore[chore.id]?.done ?? chore.completedToday;
}

/// Ticks and un-ticks chores for the session person (A3: the API only ever
/// completes for the session member, so this never acts on somebody else's
/// behalf).
///
/// Every call is idempotent per chore, so a double tap that slips through the
/// UI guards still produces exactly one request and never turns into an undo.
/// Requests of one chore run strictly in order: an undo asked for while the
/// completion is still in flight waits for it.
class ChoreActions extends Notifier<ChoreActionsState> {
  final Map<String, Future<void>> _chains = <String, Future<void>>{};
  int _active = 0;

  @override
  ChoreActionsState build() {
    ref.listen<AsyncValue<ChoresResult>>(choresProvider, (
      AsyncValue<ChoresResult>? previous,
      AsyncValue<ChoresResult> next,
    ) {
      final ChoresResult? result = next.value;
      if (result != null) {
        _reconcile(result);
      }
    });
    return const ChoreActionsState();
  }

  /// The newest copy of [chore]: the card that opened a toast may be a
  /// fetch older than the answer the server has by now.
  Chore _live(Chore chore) {
    final List<Chore>? fresh = ref.read(choresProvider).value?.chores;
    if (fresh == null) {
      return chore;
    }
    for (final Chore c in fresh) {
      if (c.id == chore.id) {
        return c;
      }
    }
    return chore;
  }

  bool isDone(Chore chore) => state.isDone(_live(chore));

  /// Ticks [chore] and opens the fresh ↶ window. No-op for a done chore.
  Future<void> complete(Chore chore) {
    final Session? session = ref.read(sessionProvider).session;
    if (session == null || isDone(chore)) {
      return Future<void>.value();
    }
    _put(
      chore.id,
      (ChoreOverlay? old) => ChoreOverlay(
        done: true,
        inflight: (old?.inflight ?? 0) + 1,
        queued: old?.queued ?? false,
      ),
    );
    _openToast(chore, UndoToastKind.fresh, _whoOf(session.member));
    return _run(chore.id, () async {
      try {
        final ChoreCompletionResult result = await ref
            .read(mutationsServiceProvider)
            .completeChore(session: session, id: chore.id);
        final bool queued = result.completionId == 'temp_pending';
        _put(chore.id, (ChoreOverlay? old) => old?.copyWith(queued: queued));
      } on MutationSessionRevokedException {
        _drop(chore.id);
        await ref.read(sessionProvider.notifier).clear();
      } on MutationNotFoundException {
        _drop(chore.id);
        ref.read(undoToastProvider).dismissChore(chore.id);
      } on MutationFetchException catch (e) {
        _failComplete(chore, session, e.message == 'QUEUE_FULL');
      } catch (_) {
        _failComplete(chore, session, false);
      } finally {
        _settle(chore.id);
      }
    });
  }

  /// Takes the person's own completion of [chore] back.
  Future<void> undo(Chore chore) {
    final Session? session = ref.read(sessionProvider).session;
    if (session == null) {
      return Future<void>.value();
    }
    ref.read(undoToastProvider).dismissChore(chore.id);
    _put(
      chore.id,
      (ChoreOverlay? old) => ChoreOverlay(
        done: false,
        inflight: (old?.inflight ?? 0) + 1,
        queued: old?.queued ?? false,
      ),
    );
    return _run(chore.id, () async {
      try {
        await ref
            .read(mutationsServiceProvider)
            .undoChoreCompletion(session: session, id: chore.id);
      } on MutationSessionRevokedException {
        _drop(chore.id);
        await ref.read(sessionProvider.notifier).clear();
      } on MutationNotFoundException {
        _drop(chore.id);
      } on MutationFetchException {
        _failUndo(chore, session);
      } catch (_) {
        _failUndo(chore, session);
      } finally {
        _settle(chore.id);
      }
    });
  }

  /// A tap on an already done card: never awards stars again, only opens the
  /// 5 s toast (with ↶ when the completion is the session person's own).
  void reveal(Chore chore) {
    final Session? session = ref.read(sessionProvider).session;
    if (session == null || !isDone(chore)) {
      return;
    }
    final ChoreMember? doer = state[chore.id] != null
        ? null
        : _live(chore).completedTodayBy;
    if (doer == null || doer.id == session.member.id) {
      _openToast(chore, UndoToastKind.revealed, _whoOf(session.member));
    } else {
      _openToast(chore, UndoToastKind.info, _whoOfChoreMember(doer));
    }
  }

  /// Forgets failed attempts, e.g. after a pull to refresh.
  void clearFailed() {
    final Map<String, ChoreOverlay> next = <String, ChoreOverlay>{
      for (final MapEntry<String, ChoreOverlay> e in state.byChore.entries)
        if (!e.value.failed) e.key: e.value,
    };
    if (next.length != state.byChore.length) {
      state = ChoreActionsState(next);
    }
  }

  // -------------------------------------------------------------------------

  static _Who _whoOf(Member m) =>
      (name: m.name, color: m.color, emoji: m.emoji);

  static _Who _whoOfChoreMember(ChoreMember m) =>
      (name: m.name, color: m.color, emoji: m.emoji);

  void _openToast(Chore chore, UndoToastKind kind, _Who who) {
    ref
        .read(undoToastProvider)
        .show(
          kind: kind,
          choreId: chore.id,
          title: chore.title,
          icon: chore.icon,
          points: chore.points,
          memberName: who.name,
          memberColor: who.color,
          memberEmoji: who.emoji,
          onUndo: kind == UndoToastKind.info
              ? null
              : () => unawaited(undo(chore)),
        );
  }

  void _failComplete(Chore chore, Session session, bool queueFull) {
    _put(
      chore.id,
      (ChoreOverlay? old) =>
          ChoreOverlay(done: false, inflight: old?.inflight ?? 0, failed: true),
    );
    final UndoToastController toasts = ref.read(undoToastProvider);
    toasts.dismissChore(chore.id);
    toasts.show(
      kind: UndoToastKind.error,
      choreId: chore.id,
      title: chore.title,
      icon: chore.icon,
      points: chore.points,
      memberName: session.member.name,
      memberColor: session.member.color,
      memberEmoji: session.member.emoji,
      onRetry: () => unawaited(complete(chore)),
      errorLine: queueFull ? ToastErrorLine.queueFull : ToastErrorLine.generic,
    );
  }

  void _failUndo(Chore chore, Session session) {
    _put(
      chore.id,
      (ChoreOverlay? old) =>
          ChoreOverlay(done: true, inflight: old?.inflight ?? 0, failed: false),
    );
    final UndoToastController toasts = ref.read(undoToastProvider);
    toasts.dismissChore(chore.id);
    toasts.show(
      kind: UndoToastKind.error,
      choreId: chore.id,
      title: chore.title,
      icon: chore.icon,
      points: chore.points,
      memberName: session.member.name,
      memberColor: session.member.color,
      memberEmoji: session.member.emoji,
      onRetry: () => unawaited(undo(chore)),
      errorLine: ToastErrorLine.undoFailed,
    );
  }

  Future<void> _run(String choreId, Future<void> Function() task) {
    _active += 1;
    final Future<void> previous = _chains[choreId] ?? Future<void>.value();
    final Future<void> run = previous.then((_) => task());
    _chains[choreId] = run;
    return run.whenComplete(() {
      _active -= 1;
      if (identical(_chains[choreId], run)) {
        _chains.remove(choreId);
      }
      if (_active == 0) {
        unawaited(_refreshAfterSettle());
      }
    });
  }

  void _settle(String choreId) {
    _put(
      choreId,
      (ChoreOverlay? old) => old?.copyWith(inflight: old.inflight - 1),
    );
  }

  /// One refetch once nothing is in flight; a refetch while other requests
  /// are still out would overwrite their optimistic state.
  Future<void> _refreshAfterSettle() async {
    ref.invalidate(choresProvider);
    try {
      final ChoresResult result = await ref.read(choresProvider.future);
      if (result.staleAt != null) {
        return;
      }
      final Map<String, ChoreOverlay> keep = <String, ChoreOverlay>{
        for (final MapEntry<String, ChoreOverlay> e in state.byChore.entries)
          if (e.value.sending || e.value.failed || e.value.queued)
            e.key: e.value,
      };
      state = ChoreActionsState(keep);
    } catch (_) {
      return;
    }
  }

  void _reconcile(ChoresResult result) {
    if (state.byChore.isEmpty) {
      return;
    }
    final Map<String, Chore> byId = <String, Chore>{
      for (final Chore c in result.chores) c.id: c,
    };
    final Map<String, ChoreOverlay> keep = <String, ChoreOverlay>{};
    for (final MapEntry<String, ChoreOverlay> e in state.byChore.entries) {
      final ChoreOverlay overlay = e.value;
      final Chore? chore = byId[e.key];
      final bool settled = !overlay.sending && !overlay.failed;
      if (chore == null && settled) {
        continue;
      }
      if (settled && chore != null && chore.completedToday == overlay.done) {
        continue;
      }
      keep[e.key] = overlay;
    }
    if (keep.length != state.byChore.length) {
      state = ChoreActionsState(keep);
    }
  }

  void _put(String choreId, ChoreOverlay? Function(ChoreOverlay? old) change) {
    final ChoreOverlay? next = change(state.byChore[choreId]);
    final Map<String, ChoreOverlay> map = Map<String, ChoreOverlay>.of(
      state.byChore,
    );
    if (next == null) {
      map.remove(choreId);
    } else {
      map[choreId] = next;
    }
    state = ChoreActionsState(map);
  }

  void _drop(String choreId) => _put(choreId, (ChoreOverlay? _) => null);
}

final NotifierProvider<ChoreActions, ChoreActionsState> choreActionsProvider =
    NotifierProvider<ChoreActions, ChoreActionsState>(ChoreActions.new);
