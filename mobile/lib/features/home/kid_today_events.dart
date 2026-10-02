import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../kids/event_groups.dart';
import '../../kids/kid_avatar.dart';
import '../../kids/kid_group_widgets.dart';
import '../../kids/kid_member_strip.dart';
import '../../kids/kid_states.dart';
import '../../kids/kid_tap.dart';
import '../../kids/kid_theme.dart';
import '../../kids/picto.dart';
import '../../kids/picto_resolver.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/event.dart';
import '../../services/events_service.dart';
import '../../state/events_provider.dart';
import '../../state/kid_clock_provider.dart';
import '../../state/session_provider.dart';
import '../../widgets/cached_at_pill.dart';

/// "Heute" events card (R8): all of today's events, grouped Morgens / Tagsüber
/// / Abends with all-day on top, a picto and the person's avatar per event,
/// past ones muted, the running one framed, and a person filter.
class KidTodayEventsCard extends ConsumerStatefulWidget {
  const KidTodayEventsCard({required this.range, super.key});

  final EventsRange range;

  @override
  ConsumerState<KidTodayEventsCard> createState() => _KidTodayEventsCardState();
}

class _KidTodayEventsCardState extends ConsumerState<KidTodayEventsCard> {
  String? _filterId;

  void _select(String id) {
    setState(() {
      _filterId = id == kAllId || id == _filterId ? null : id;
    });
  }

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final AppL10n l10n = AppL10n.of(context);
    final String locale = Localizations.localeOf(context).toString();
    final DateTime now = ref.watch(kidClockProvider)();
    final AsyncValue<EventsResult> eventsAsync = ref.watch(
      eventsProvider(widget.range),
    );
    final EventsResult? data = eventsAsync.value;

    final String heading = l10n.homeTodayHeading(
      DateFormat.yMMMMEEEEd(locale).format(now),
    );

    Widget body;
    if (data == null && eventsAsync.hasError) {
      final Object? err = eventsAsync.error;
      final bool expired = err is EventsSessionRevokedException;
      body = KidLoadError(
        message: expired ? l10n.homeSessionExpired : l10n.kidLoadError,
        onRetry: expired
            ? () => ref.read(sessionProvider.notifier).clear()
            : () => ref.invalidate(eventsProvider(widget.range)),
      );
    } else if (data == null) {
      body = Column(
        children: <Widget>[
          for (int i = 0; i < 3; i++) ...<Widget>[
            if (i > 0) const SizedBox(height: 8),
            const KidSkeletonCard(height: 72),
          ],
        ],
      );
    } else {
      final List<EventBandGroup> all = groupTodaysEvents(data.events, now);
      final Map<String, EventMember> people = <String, EventMember>{
        for (final EventBandGroup g in all)
          for (final TodayEventEntry e in g.entries)
            e.event.member.id: e.event.member,
      };
      final List<EventBandGroup> groups = _filterId == null
          ? all
          : groupTodaysEvents(data.events, now, memberId: _filterId);
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (eventsAsync.hasError) ...<Widget>[
            KidLoadError(
              message: l10n.kidLoadError,
              compact: true,
              onRetry: () => ref.invalidate(eventsProvider(widget.range)),
            ),
            const SizedBox(height: 12),
          ],
          if (people.length > 1) ...<Widget>[
            KidMemberStrip(
              people: <KidStripPerson>[
                for (final EventMember m in people.values)
                  KidStripPerson(
                    id: m.id,
                    name: m.name,
                    color: m.color,
                    emoji: m.emoji,
                  ),
              ],
              selectedId: _filterId ?? kAllId,
              onSelect: _select,
              allLabel: l10n.kidFilterAll,
            ),
            const SizedBox(height: 8),
          ],
          if (groups.isEmpty)
            KidEmptyState(message: l10n.homeNoEvents)
          else
            for (final EventBandGroup group in groups) ...<Widget>[
              _BandHeader(band: group.band),
              const SizedBox(height: 4),
              for (final TodayEventEntry entry in group.entries) ...<Widget>[
                _EventRow(entry: entry, locale: locale),
                const SizedBox(height: 8),
              ],
              const SizedBox(height: 4),
            ],
        ],
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: tokens.surface,
        borderRadius: KidRadius.groupBorder,
        border: Border.all(color: tokens.border, width: 2),
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
          Semantics(
            header: true,
            child: Text(
              heading,
              style: KidText.titleLg.copyWith(color: tokens.ink),
            ),
          ),
          const SizedBox(height: 12),
          body,
        ],
      ),
    );
  }
}

class _BandHeader extends StatelessWidget {
  const _BandHeader({required this.band});

  final EventBand band;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final AppL10n l10n = AppL10n.of(context);
    final (String picto, String label) = switch (band) {
      EventBand.allDay => ('tod-anytime', l10n.homeAllDay),
      EventBand.morning => ('tod-morning', pictoLabel(context, 'tod-morning')),
      EventBand.day => ('tod-day', pictoLabel(context, 'tod-day')),
      EventBand.evening => ('tod-evening', pictoLabel(context, 'tod-evening')),
    };
    return Semantics(
      header: true,
      label: label,
      excludeSemantics: true,
      child: SizedBox(
        height: 44,
        child: Row(
          children: <Widget>[
            KidPicto(picto, size: 36),
            const SizedBox(width: 8),
            Text(label, style: KidText.title.copyWith(color: tokens.ink)),
          ],
        ),
      ),
    );
  }
}

class _EventRow extends StatelessWidget {
  const _EventRow({required this.entry, required this.locale});

  final TodayEventEntry entry;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final AppL10n l10n = AppL10n.of(context);
    final MobileEvent event = entry.event;
    final String colorName = event.color ?? event.member.color;
    final KidAccent accent = tokens.accent(colorName);
    final bool past = entry.past;
    final bool current = entry.current;

    final String timeLabel = event.allDay
        ? l10n.homeAllDay
        : '${DateFormat.Hm(locale).format(entry.start)} – ${DateFormat.Hm(locale).format(entry.end)}';

    final String? pictoName = resolveEventPicto(null, event.title);
    final double tile = past ? 48 : 56;
    final Color titleColor = past ? tokens.muted : tokens.ink;

    final String spoken = <String>[
      event.title,
      timeLabel,
      event.member.name,
      if (current) l10n.kidNow,
      if (past) l10n.kidEventPast,
    ].join(', ');

    return KidTap(
      onTap: () => context.go('/calendar'),
      semanticLabel: spoken,
      borderRadius: KidRadius.cardBorder,
      builder: (BuildContext context, KidTapState tap) {
        return Container(
          constraints: const BoxConstraints(minHeight: 72),
          padding: const EdgeInsets.fromLTRB(8, 8, 12, 8),
          decoration: BoxDecoration(
            color: current ? tokens.surface : tokens.bg,
            borderRadius: KidRadius.cardBorder,
            border: Border.all(
              color: current ? accent.base : tokens.border,
              width: current ? 3 : 2,
            ),
            boxShadow: current ? KidElevation.pop(tokens) : null,
          ),
          child: Row(
            children: <Widget>[
              SizedBox.square(
                dimension: 56,
                child: Center(
                  child: Container(
                    width: tile,
                    height: tile,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: accent.tint,
                      borderRadius: KidRadius.pictoTileBorder,
                    ),
                    child: pictoName != null
                        ? KidPicto(pictoName, size: past ? 36 : 44)
                        : _CalendarLeaf(
                            date: entry.start,
                            accent: accent,
                            size: past ? 36 : 44,
                          ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      event.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: KidText.title.copyWith(
                        color: titleColor,
                        fontWeight: past ? FontWeight.w500 : FontWeight.w600,
                      ),
                    ),
                    Row(
                      children: <Widget>[
                        if (current) ...<Widget>[
                          Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(
                              color: accent.base,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            l10n.kidNow,
                            style: KidText.label.copyWith(color: tokens.ink),
                          ),
                          const SizedBox(width: 8),
                        ],
                        Flexible(
                          child: Text(
                            timeLabel,
                            style: KidText.label.copyWith(
                              color: tokens.muted,
                              fontFeatures: const <FontFeature>[
                                FontFeature.tabularFigures(),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              KidAvatar(
                name: event.member.name,
                color: event.member.color,
                emoji: event.member.emoji,
                size: KidAvatarSize.sm,
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Neutral event picture (R3.2): a calendar leaf with the day number in the
/// person's colour.
class _CalendarLeaf extends StatelessWidget {
  const _CalendarLeaf({
    required this.date,
    required this.accent,
    required this.size,
  });

  final DateTime date;
  final KidAccent accent;
  final double size;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    return Container(
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: tokens.surface,
        borderRadius: BorderRadius.circular(size * 0.2),
        border: Border.all(color: accent.base, width: 2),
      ),
      child: Column(
        children: <Widget>[
          Container(height: size * 0.28, color: accent.base),
          Expanded(
            child: Center(
              child: Text(
                '${date.day}',
                textScaler: TextScaler.noScaling,
                style: KidText.label.copyWith(
                  color: tokens.ink,
                  fontSize: size * 0.4,
                  height: 1,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
