/// The chore list of one person (or "for everyone"): day-phase groups with
/// kid cards, ✓-strips, collapsed chip rows and the column state (R4.4-R4.6),
/// held still while a finger is on it (R5.4) and guarded against stray taps
/// (R5.5). Used by the Aufgaben board and by Heute.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../models/chore.dart';
import '../models/session.dart';
import '../state/chore_actions.dart';
import '../state/kid_clock_provider.dart';
import '../state/session_provider.dart';
import '../state/undo_toast_provider.dart';
import 'chore_state.dart';
import 'kid_chore_card.dart';
import 'kid_group_widgets.dart';
import 'kid_states.dart';
import 'kid_stars.dart';
import 'layout_hold.dart';
import 'tap_guards.dart';
import 'time_of_day.dart';

/// Accent used for "for everyone" chores.
const String kEveryoneAccent = 'sand';

/// What decides where cards sit; held back while a child is still tapping.
class _LayoutSource {
  const _LayoutSource({
    required this.chores,
    required this.doneIds,
    required this.now,
  });

  final List<Chore> chores;
  final Set<String> doneIds;
  final DateTime now;
}

class KidChoreSection extends ConsumerStatefulWidget {
  const KidChoreSection({
    required this.chores,
    required this.listKey,
    required this.ownerId,
    required this.accentName,
    this.interactive = true,
    this.starTarget,
    this.onAdd,
    super.key,
  });

  /// The chores to show, in API order.
  final List<Chore> chores;

  /// Identifies this list for the tap guards (R5.5).
  final String listKey;

  /// Whose board this is; null for the "for everyone" board. Decides who the
  /// "next" card belongs to.
  final String? ownerId;

  /// Colour of the board (the person's, or sand).
  final String accentName;

  /// False on somebody else's board: cards show but do not react.
  final bool interactive;

  /// Where the stars fly to (the person's counter).
  final GlobalKey? starTarget;

  /// Admin-only "+" in the empty state. Null for children (R6.3).
  final VoidCallback? onAdd;

  @override
  ConsumerState<KidChoreSection> createState() => _KidChoreSectionState();
}

class _KidChoreSectionState extends ConsumerState<KidChoreSection> {
  HeldLayout<_LayoutSource>? _held;
  final Map<PhaseGroupKey, bool> _overrides = <PhaseGroupKey, bool>{};
  Timer? _holdTimer;
  Timer? _clockTimer;

  @override
  void initState() {
    super.initState();
    _clockTimer = Timer.periodic(const Duration(seconds: 30), (Timer _) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _holdTimer?.cancel();
    _clockTimer?.cancel();
    super.dispose();
  }

  void _syncHoldTimer(bool held) {
    if (held && _holdTimer == null) {
      _holdTimer = Timer.periodic(const Duration(milliseconds: 250), (Timer _) {
        final bool open = ref.read(undoToastProvider).undoWindowOpen;
        if (_held?.tick(windowOpen: open) ?? false) {
          if (mounted) {
            setState(() {});
          }
        }
        if (!(_held?.held ?? false)) {
          _holdTimer?.cancel();
          _holdTimer = null;
        }
      });
    } else if (!held) {
      _holdTimer?.cancel();
      _holdTimer = null;
    }
  }

  bool _onPress(Chore chore, Offset center) {
    final TapGuard guard = ref.read(tapGuardProvider);
    final TapVerdict verdict = guard.check(widget.listKey, chore.id);
    if (!verdict.isAllowed) {
      return false;
    }
    final ChoreActions actions = ref.read(choreActionsProvider.notifier);
    if (actions.isDone(chore)) {
      actions.reveal(chore);
      return true;
    }
    guard.recordCompletion(widget.listKey, chore.id);
    KidStarFlight.play(
      context,
      from: center,
      target: widget.starTarget,
      stars: chore.points,
    );
    unawaited(actions.complete(chore));
    return true;
  }

  void _toggle(PhaseGroupKey key, bool expanded) {
    ref.read(tapGuardProvider).recordLayoutShift(widget.listKey);
    setState(() => _overrides[key] = !expanded);
  }

  ChoreMember? _stampFor(Chore chore, ChoreActionsState actions, Session? s) {
    if (chore.memberId != null) {
      return null;
    }
    if (actions[chore.id] != null && s != null) {
      return ChoreMember(
        id: s.member.id,
        name: s.member.name,
        color: s.member.color,
        emoji: s.member.emoji,
      );
    }
    return chore.completedTodayBy;
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final Clock clock = ref.watch(kidClockProvider);
    final DateTime now = clock();
    final ChoreActionsState actions = ref.watch(choreActionsProvider);
    final Session? session = ref.watch(sessionProvider).session;
    final List<Chore> chores = widget.chores;
    final String? owner = widget.ownerId;

    if (chores.isEmpty) {
      return KidEmptyState(message: l10n.kidNoChores, onAdd: widget.onAdd);
    }

    bool isDone(Chore c) => actions.isDone(c);
    final Set<String> doneIds = <String>{
      for (final Chore c in chores)
        if (isDone(c)) c.id,
    };
    List<Completion> completionsOf(Set<String> ids) => <Completion>[
      for (final String id in ids) Completion(choreId: id, memberId: owner),
    ];

    final String signature = <String>[
      phaseOf(now).name,
      chores
          .map((Chore c) => '${c.id}:${c.timeOfDay?.apiValue ?? '-'}')
          .join(','),
      chores.where(isDone).map((Chore c) => c.id).join(','),
    ].join('|');
    final _LayoutSource live = _LayoutSource(
      chores: chores,
      doneIds: doneIds,
      now: now,
    );
    final bool windowOpen = ref.read(undoToastProvider).undoWindowOpen;
    final HeldLayout<_LayoutSource> held = _held ??= HeldLayout<_LayoutSource>(
      guard: ref.read(tapGuardProvider),
      initial: live,
      signature: signature,
      onShift: () =>
          ref.read(tapGuardProvider).recordLayoutShift(widget.listKey),
    );
    held.update(live, signature, windowOpen: windowOpen);
    _syncHoldTimer(held.held);

    final _LayoutSource layout = held.value;
    final List<Completion> layoutCompletions = completionsOf(layout.doneIds);
    final ColumnSummary<Chore>? layoutSummary = owner == null
        ? null
        : columnSummary(owner, layout.chores, layoutCompletions, layout.now);
    final List<ChoreGroup<Chore>> groups = groupByPhase<Chore>(
      layout.chores,
      layoutCompletions,
      layoutSummary?.next?.id,
    );
    final Set<PhaseGroupKey> expandedDefault = expandedGroupKeys(
      phaseOf(layout.now),
      layoutSummary?.next,
    );
    final String? liveNextId = owner == null
        ? null
        : nextChoreFor<Chore>(owner, chores, completionsOf(doneIds), now)?.id;
    final Map<String, Chore> liveById = <String, Chore>{
      for (final Chore c in chores) c.id: c,
    };

    ChoreStatus statusOf(Chore c) => isDone(c)
        ? ChoreStatus.done
        : c.id == liveNextId
        ? ChoreStatus.next
        : ChoreStatus.open;

    final PhaseGroupKey? currentGroup = groupKeyOfPhase(phaseOf(layout.now));
    final double cardHeight = kidCardHeight(context);
    final String accent = widget.accentName;
    final ColumnState? panel = layoutSummary?.state;
    final bool showPanel =
        panel != null &&
        panel != ColumnState.active &&
        panel != ColumnState.empty;

    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (PointerDownEvent _) => ref.read(tapGuardProvider).touch(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (showPanel) ...<Widget>[
            KidStatePanel(state: panel, upcoming: layoutSummary!.upcomingPhase),
            const SizedBox(height: 12),
          ],
          for (final ChoreGroup<Chore> group in groups) ...<Widget>[
            _buildGroup(
              group: group,
              liveById: liveById,
              statusOf: statusOf,
              isDone: isDone,
              layoutDone: layout.doneIds,
              expanded:
                  _overrides[group.key] ??
                  (owner == null || expandedDefault.contains(group.key)),
              current: group.key == currentGroup,
              accent: accent,
              cardHeight: cardHeight,
              actions: actions,
              session: session,
            ),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }

  Widget _buildGroup({
    required ChoreGroup<Chore> group,
    required Map<String, Chore> liveById,
    required ChoreStatus Function(Chore) statusOf,
    required bool Function(Chore) isDone,
    required Set<String> layoutDone,
    required bool expanded,
    required bool current,
    required String accent,
    required double cardHeight,
    required ChoreActionsState actions,
    required Session? session,
  }) {
    final List<({Chore chore, ChoreStatus status})> entries =
        <({Chore chore, ChoreStatus status})>[
          for (final ChoreEntry<Chore> e in group.entries)
            if (liveById[e.chore.id] != null)
              (
                chore: liveById[e.chore.id]!,
                status: statusOf(liveById[e.chore.id]!),
              ),
        ];
    final int doneCount = entries
        .where((e) => e.status == ChoreStatus.done)
        .length;
    final List<Chore> folded = <Chore>[
      for (final e in entries)
        if (layoutDone.contains(e.chore.id)) e.chore,
    ];
    final bool fold = folded.length >= 2;
    final Set<String> foldedIds = <String>{for (final Chore c in folded) c.id};
    final List<({Chore chore, ChoreStatus status})> cards = fold
        ? <({Chore chore, ChoreStatus status})>[
            for (final e in entries)
              if (!foldedIds.contains(e.chore.id)) e,
          ]
        : entries;

    if (!expanded) {
      return KidGroupChips(
        key: ValueKey<PhaseGroupKey>(group.key),
        group: group.key,
        chores: <Chore>[for (final e in entries) e.chore],
        isDone: isDone,
        accentName: accent,
        onToggle: () => _toggle(group.key, false),
      );
    }

    return Column(
      key: ValueKey<PhaseGroupKey>(group.key),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        KidGroupHeader(
          group: group.key,
          done: doneCount,
          total: entries.length,
          accentName: accent,
          current: current,
          onToggle: () => _toggle(group.key, true),
        ),
        const SizedBox(height: 4),
        for (int i = 0; i < cards.length; i++) ...<Widget>[
          if (i > 0) const SizedBox(height: 12),
          _card(
            cards[i].chore,
            cards[i].status,
            accent,
            cardHeight,
            actions,
            session,
          ),
        ],
        if (fold) ...<Widget>[
          const SizedBox(height: 12),
          KidDoneStrip(
            chores: folded,
            isDone: isDone,
            accentName: accent,
            interactive: widget.interactive,
            onPress: _onPress,
          ),
        ],
      ],
    );
  }

  Widget _card(
    Chore chore,
    ChoreStatus status,
    String accent,
    double height,
    ChoreActionsState actions,
    Session? session,
  ) {
    final ChoreOverlay? overlay = actions[chore.id];
    final ChoreMember? stamp = status == ChoreStatus.done
        ? _stampFor(chore, actions, session)
        : null;
    return KidChoreCard(
      key: ValueKey<String>(chore.id),
      chore: chore,
      view: KidCardView(
        status: status,
        sending: overlay?.sending ?? false,
        failed: overlay?.failed ?? false,
        queued: overlay?.queued ?? false,
      ),
      accentName: stamp?.color ?? accent,
      height: height,
      interactive: widget.interactive,
      stamp: stamp,
      onPress: (Offset center) => _onPress(chore, center),
    );
  }
}
