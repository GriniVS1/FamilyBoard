import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../kids/kid_avatar.dart';
import '../../kids/kid_chore_card.dart';
import '../../kids/kid_chore_section.dart';
import '../../kids/kid_member_strip.dart';
import '../../kids/kid_scroll_guard.dart';
import '../../kids/kid_stars.dart';
import '../../kids/kid_states.dart';
import '../../kids/kid_tap.dart';
import '../../kids/kid_theme.dart';
import '../../kids/points.dart';
import '../../kids/undo_toast.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chore.dart';
import '../../models/family_member.dart';
import '../../models/session.dart';
import '../../services/chores_service.dart';
import '../../state/chore_actions.dart';
import '../../state/chores_provider.dart';
import '../../state/members_provider.dart';
import '../../state/session_provider.dart';
import '../../state/stars_provider.dart';
import '../../widgets/adaptive_layout.dart';
import '../../widgets/cached_at_pill.dart';
import '../../widgets/familyboard_logo.dart';
import '../../widgets/queue_badge.dart';
import '../chores/chore_create_sheet.dart';

/// Tab key of the Aufgaben board for the tap guards (R5.5).
const String kTasksListKey = 'tasks';

/// "Aufgaben" tab (R4-R6): the chore board of one person at a time, the
/// session person first. The phone is one person's device and the API only
/// ever ticks for the session person (A3), so the other boards are read-only.
class TasksScreen extends ConsumerStatefulWidget {
  const TasksScreen({super.key});

  @override
  ConsumerState<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends ConsumerState<TasksScreen> {
  String? _selectedId;
  final GlobalKey _counterKey = GlobalKey(debugLabel: 'star-counter');

  Future<void> _refresh() async {
    ref.read(choreActionsProvider.notifier).clearFailed();
    ref.invalidate(choresProvider);
    ref.invalidate(membersProvider);
    try {
      await ref.read(choresProvider.future);
    } catch (_) {
      return;
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final Session? session = ref.watch(sessionProvider).session;
    final AsyncValue<ChoresResult> choresAsync = ref.watch(choresProvider);
    final MembersResult? members = ref.watch(membersProvider).value;
    final ChoreActionsState actions = ref.watch(choreActionsProvider);
    final double cardHeight = kidCardHeight(context);

    final ChoresResult? data = choresAsync.value;
    final bool isAdmin = members?.isAdmin ?? false;

    Widget body;
    if (session == null) {
      body = const SizedBox.shrink();
    } else if (data == null && choresAsync.hasError) {
      final Object? err = choresAsync.error;
      final bool expired = err is ChoresSessionRevokedException;
      body = ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: <Widget>[
          KidLoadError(
            message: expired ? l10n.homeSessionExpired : l10n.kidLoadError,
            onRetry: expired
                ? () => ref.read(sessionProvider.notifier).clear()
                : _refresh,
          ),
        ],
      );
    } else if (data == null) {
      body = ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
        children: <Widget>[KidChoreSkeleton(cardHeight: cardHeight)],
      );
    } else {
      body = _Board(
        session: session,
        data: data,
        members: members?.members ?? const <FamilyMember>[],
        actions: actions,
        selectedId: _selectedId ?? session.member.id,
        onSelect: (String id) => setState(() => _selectedId = id),
        counterKey: _counterKey,
        isAdmin: isAdmin,
        loadFailed: choresAsync.hasError,
        onRetry: _refresh,
        onRefresh: _refresh,
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const FamilyBoardLogo(fontSize: 18),
        actions: const <Widget>[QueueBadge()],
      ),
      body: SafeArea(
        child: ConstrainedContent(
          child: KidScrollGuard(
            listKey: kTasksListKey,
            child: data == null
                ? RefreshIndicator(onRefresh: _refresh, child: body)
                : body,
          ),
        ),
      ),
    );
  }
}

/// The persons shown in the strip: the session person first, then the others
/// in the order the wall lists them.
List<KidStripPerson> _stripPeople({
  required Session session,
  required List<FamilyMember> members,
  required List<Chore> chores,
  required bool Function(Chore) isDone,
}) {
  final List<({String id, String name, String color, String emoji})> base =
      <({String id, String name, String color, String emoji})>[
        (
          id: session.member.id,
          name: session.member.name,
          color: session.member.color,
          emoji: session.member.emoji,
        ),
        for (final FamilyMember m in members)
          if (m.id != session.member.id)
            (id: m.id, name: m.name, color: m.color, emoji: m.emoji),
      ];
  return <KidStripPerson>[
    for (final p in base)
      () {
        final List<Chore> own = chores
            .where((Chore c) => c.memberId == p.id)
            .toList();
        final int done = own.where(isDone).length;
        return KidStripPerson(
          id: p.id,
          name: p.name,
          color: p.color,
          emoji: p.emoji,
          openCount: own.length - done,
          progress: (done: done, total: own.length),
        );
      }(),
  ];
}

class _Board extends ConsumerWidget {
  const _Board({
    required this.session,
    required this.data,
    required this.members,
    required this.actions,
    required this.selectedId,
    required this.onSelect,
    required this.counterKey,
    required this.isAdmin,
    required this.loadFailed,
    required this.onRetry,
    required this.onRefresh,
  });

  final Session session;
  final ChoresResult data;
  final List<FamilyMember> members;
  final ChoreActionsState actions;
  final String selectedId;
  final void Function(String id) onSelect;
  final GlobalKey counterKey;
  final bool isAdmin;
  final bool loadFailed;
  final VoidCallback onRetry;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppL10n l10n = AppL10n.of(context);
    final List<Chore> chores = data.chores;
    final List<KidStripPerson> people = _stripPeople(
      session: session,
      members: members,
      chores: chores,
      isDone: actions.isDone,
    );
    final List<Chore> everyone = chores
        .where((Chore c) => c.memberId == null)
        .toList();
    final int everyoneOpen = everyone
        .where((Chore c) => !actions.isDone(c))
        .length;
    final bool forEveryone = selectedId == kEveryoneId;
    final KidStripPerson? person = people
        .where((KidStripPerson p) => p.id == selectedId)
        .firstOrNull;
    final String? ownerId = forEveryone ? null : person?.id;
    final bool mine = forEveryone || ownerId == session.member.id;
    final List<Chore> shown = forEveryone
        ? everyone
        : chores.where((Chore c) => c.memberId == ownerId).toList();
    final String accent = forEveryone
        ? kEveryoneAccent
        : (person?.color ?? kEveryoneAccent);
    final String boardName = forEveryone
        ? l10n.kidEveryone
        : (person?.name ?? '');

    return Column(
      children: <Widget>[
        const SizedBox(height: 8),
        KidMemberStrip(
          people: people,
          selectedId: forEveryone ? kEveryoneId : person?.id,
          onSelect: onSelect,
          everyoneOpenCount: everyoneOpen,
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: onRefresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, kToastListPadding),
              children: <Widget>[
                if (data.staleAt != null) ...<Widget>[
                  Align(
                    alignment: Alignment.centerLeft,
                    child: CachedAtPill(staleAt: data.staleAt),
                  ),
                  const SizedBox(height: 8),
                ],
                if (loadFailed) ...<Widget>[
                  KidLoadError(
                    message: l10n.kidLoadError,
                    onRetry: onRetry,
                    compact: true,
                  ),
                  const SizedBox(height: 12),
                ],
                _BoardHead(
                  person: forEveryone ? null : person,
                  name: boardName,
                  counterKey: counterKey,
                  showCounter: !forEveryone && ownerId != null,
                  onAdd: isAdmin
                      ? () => showChoreCreateSheet(
                          context,
                          memberId: forEveryone ? null : ownerId,
                        )
                      : null,
                ),
                if (!mine) ...<Widget>[
                  const SizedBox(height: 8),
                  _ReadOnlyHint(name: boardName),
                ],
                const SizedBox(height: 12),
                KidChoreSection(
                  key: ValueKey<String>('board-$selectedId'),
                  chores: shown,
                  listKey: kTasksListKey,
                  ownerId: ownerId,
                  accentName: accent,
                  interactive: mine,
                  starTarget: forEveryone ? null : counterKey,
                  onAdd: isAdmin
                      ? () => showChoreCreateSheet(
                          context,
                          memberId: forEveryone ? null : ownerId,
                        )
                      : null,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _BoardHead extends ConsumerWidget {
  const _BoardHead({
    required this.person,
    required this.name,
    required this.counterKey,
    required this.showCounter,
    required this.onAdd,
  });

  final KidStripPerson? person;
  final String name;
  final GlobalKey counterKey;
  final bool showCounter;
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final KidTokens tokens = context.kid;
    final AppL10n l10n = AppL10n.of(context);
    final KidAccent accent = tokens.accent(person?.color ?? kEveryoneAccent);
    final StarCount? stars = person == null
        ? null
        : ref.watch(starCountProvider(person!.id));
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: accent.tint,
        borderRadius: KidRadius.groupBorder,
      ),
      child: Row(
        children: <Widget>[
          if (person != null)
            KidAvatar(
              name: person!.name,
              color: person!.color,
              emoji: person!.emoji,
              size: KidAvatarSize.lg,
            )
          else
            Container(
              width: 72,
              height: 72,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: tokens.surface,
                border: Border.all(color: tokens.muted, width: 2),
              ),
              child: Icon(Icons.groups_rounded, size: 36, color: tokens.ink),
            ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: KidText.titleLg.copyWith(color: accent.ink),
                ),
                if (showCounter) ...<Widget>[
                  const SizedBox(height: 6),
                  KeyedSubtree(
                    key: counterKey,
                    child: KidStarCounter(count: stars, name: name),
                  ),
                ],
              ],
            ),
          ),
          if (onAdd != null)
            KidRoundButton(
              size: KidTouch.primary,
              semanticLabel: person == null
                  ? l10n.kidAddChoreForEveryone
                  : l10n.kidAddChoreFor(name),
              onTap: onAdd,
              child: Icon(Icons.add_rounded, size: 36, color: tokens.ink),
            ),
        ],
      ),
    );
  }
}

class _ReadOnlyHint extends StatelessWidget {
  const _ReadOnlyHint({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final AppL10n l10n = AppL10n.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: tokens.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tokens.border, width: 2),
      ),
      child: Row(
        children: <Widget>[
          Icon(Icons.visibility_outlined, size: 24, color: tokens.muted),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              l10n.kidReadOnly(name),
              style: KidText.label.copyWith(color: tokens.ink),
            ),
          ),
        ],
      ),
    );
  }
}
