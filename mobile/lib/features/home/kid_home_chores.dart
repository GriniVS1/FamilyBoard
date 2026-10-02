import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../kids/kid_avatar.dart';
import '../../kids/kid_chore_card.dart';
import '../../kids/kid_chore_section.dart';
import '../../kids/kid_stars.dart';
import '../../kids/kid_states.dart';
import '../../kids/kid_tap.dart';
import '../../kids/kid_theme.dart';
import '../../kids/points.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/chore.dart';
import '../../models/session.dart';
import '../../services/chores_service.dart';
import '../../state/chore_actions.dart';
import '../../state/chores_provider.dart';
import '../../state/members_provider.dart';
import '../../state/session_provider.dart';
import '../../state/stars_provider.dart';
import '../../widgets/cached_at_pill.dart';
import '../chores/chore_create_sheet.dart';
import 'home_chore_filter.dart';

/// List key of the Heute chore card for the tap guards (R5.5).
const String kHomeListKey = 'home';

/// The Ämtli card of Heute: the session person's chores plus the unassigned
/// ones, with the same kid cards, day-phase groups and stillness rules as the
/// Aufgaben board.
class KidHomeChoresCard extends ConsumerStatefulWidget {
  const KidHomeChoresCard({required this.session, super.key});

  final Session session;

  @override
  ConsumerState<KidHomeChoresCard> createState() => _KidHomeChoresCardState();
}

class _KidHomeChoresCardState extends ConsumerState<KidHomeChoresCard> {
  final GlobalKey _counterKey = GlobalKey(debugLabel: 'home-star-counter');

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final AppL10n l10n = AppL10n.of(context);
    final Session session = widget.session;
    final KidAccent accent = tokens.accent(session.member.color);
    final AsyncValue<ChoresResult> choresAsync = ref.watch(choresProvider);
    final ChoresResult? data = choresAsync.value;
    final ChoreActionsState actions = ref.watch(choreActionsProvider);
    final bool isAdmin = ref.watch(membersProvider).value?.isAdmin ?? false;
    final StarCount? stars = ref.watch(starCountProvider(session.member.id));

    final List<Chore> visible = data == null
        ? const <Chore>[]
        : filterHomeChores<Chore>(data.chores, session.member.id);
    final List<Chore> own = visible
        .where((Chore c) => c.memberId == session.member.id)
        .toList();
    final int done = own.where(actions.isDone).length;

    Widget body;
    if (data == null && choresAsync.hasError) {
      final bool expired = choresAsync.error is ChoresSessionRevokedException;
      body = KidLoadError(
        message: expired ? l10n.homeSessionExpired : l10n.kidLoadError,
        onRetry: expired
            ? () => ref.read(sessionProvider.notifier).clear()
            : () => ref.invalidate(choresProvider),
      );
    } else if (data == null) {
      body = KidChoreSkeleton(cardHeight: kidCardHeight(context), count: 2);
    } else {
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (choresAsync.hasError) ...<Widget>[
            KidLoadError(
              message: l10n.kidLoadError,
              compact: true,
              onRetry: () => ref.invalidate(choresProvider),
            ),
            const SizedBox(height: 12),
          ],
          KidChoreSection(
            chores: visible,
            listKey: kHomeListKey,
            ownerId: session.member.id,
            accentName: session.member.color,
            starTarget: _counterKey,
            onAdd: isAdmin
                ? () =>
                      showChoreCreateSheet(context, memberId: session.member.id)
                : null,
          ),
        ],
      );
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: accent.tint,
        borderRadius: KidRadius.groupBorder,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (data?.staleAt != null) ...<Widget>[
            Align(
              alignment: Alignment.centerLeft,
              child: CachedAtPill(staleAt: data!.staleAt),
            ),
            const SizedBox(height: 8),
          ],
          Row(
            children: <Widget>[
              KidAvatar(
                name: session.member.name,
                color: session.member.color,
                emoji: session.member.emoji,
                size: KidAvatarSize.lg,
                progress: own.isEmpty ? null : (done: done, total: own.length),
                openCount: data == null ? null : own.length - done,
                semanticLabel: l10n.kidAvatarOpen(
                  session.member.name,
                  own.length - done,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      session.member.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: KidText.titleLg.copyWith(color: accent.ink),
                    ),
                    const SizedBox(height: 6),
                    KeyedSubtree(
                      key: _counterKey,
                      child: KidStarCounter(
                        count: stars,
                        name: session.member.name,
                      ),
                    ),
                  ],
                ),
              ),
              if (isAdmin)
                KidRoundButton(
                  size: KidTouch.primary,
                  semanticLabel: l10n.kidAddChoreFor(session.member.name),
                  onTap: () => showChoreCreateSheet(
                    context,
                    memberId: session.member.id,
                  ),
                  child: Icon(Icons.add_rounded, size: 36, color: tokens.ink),
                ),
            ],
          ),
          const SizedBox(height: 12),
          body,
          const SizedBox(height: 4),
          KidTap(
            onTap: () => context.go('/tasks'),
            semanticLabel: l10n.kidSeeAllTasks,
            borderRadius: BorderRadius.circular(16),
            builder: (BuildContext context, KidTapState tap) {
              return Container(
                height: 56,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: tokens.surface.withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(
                      l10n.homeSeeAll,
                      style: KidText.title.copyWith(color: tokens.ink),
                    ),
                    const SizedBox(width: 4),
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 28,
                      color: tokens.ink,
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
