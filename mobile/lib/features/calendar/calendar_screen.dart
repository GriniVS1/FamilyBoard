import 'dart:collection';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../models/event.dart';
import '../../services/events_service.dart';
import '../../state/events_provider.dart';
import '../../state/session_provider.dart';
import '../../theme.dart';
import '../../widgets/familyboard_logo.dart';

/// Maximum days forward from today the user can extend to via "Load more".
const int _maxExtensionDays = 180;

/// Each load-more tap extends the window by this many days.
const int _extensionStepDays = 30;

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  late DateTime _from;
  late DateTime _to;

  /// null means "All" (no filter applied).
  String? _selectedMemberId;

  @override
  void initState() {
    super.initState();
    final DateTime now = _today();
    _from = now;
    _to = now.add(const Duration(days: 30));
  }

  /// Local midnight today on the device.
  DateTime _today() {
    final DateTime now = DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }

  bool get _canLoadMore {
    final DateTime maxTo =
        _today().add(const Duration(days: _maxExtensionDays));
    return _to.isBefore(maxTo);
  }

  void _loadMore() {
    if (!_canLoadMore) {
      return;
    }
    final DateTime maxTo =
        _today().add(const Duration(days: _maxExtensionDays));
    setState(() {
      _to =
          _to.add(const Duration(days: _extensionStepDays)).compareTo(maxTo) < 0
              ? _to.add(const Duration(days: _extensionStepDays))
              : maxTo;
    });
  }

  Future<void> _refresh() async {
    final EventsRange range = EventsRange(from: _from, to: _to);
    ref.invalidate(eventsProvider(range));
    try {
      await ref.read(eventsProvider(range).future);
    } catch (_) {}
  }

  /// Builds the ordered set of distinct members from loaded events.
  /// Uses [LinkedHashMap] so chip order is stable (insertion order == event order).
  LinkedHashMap<String, EventMember> _distinctMembers(
      List<MobileEvent> events) {
    final LinkedHashMap<String, EventMember> map =
        LinkedHashMap<String, EventMember>();
    for (final MobileEvent e in events) {
      map.putIfAbsent(e.member.id, () => e.member);
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final EventsRange range = EventsRange(from: _from, to: _to);
    final AsyncValue<List<MobileEvent>> eventsAsync =
        ref.watch(eventsProvider(range));

    return Scaffold(
      appBar: AppBar(
        title: const FamilyBoardLogo(fontSize: 18),
      ),
      body: SafeArea(
        child: eventsAsync.when(
          loading: () => const Column(
            children: <Widget>[
              SizedBox(height: 0),
              Expanded(child: _LoadingBody()),
            ],
          ),
          error: (Object err, StackTrace _) => RefreshIndicator(
            onRefresh: _refresh,
            child: _ErrorBody(
              error: err,
              l10n: l10n,
              onRetry: () {
                final EventsRange r = EventsRange(from: _from, to: _to);
                ref.invalidate(eventsProvider(r));
              },
              onSessionExpired: () async {
                await ref.read(sessionProvider.notifier).clear();
              },
            ),
          ),
          data: (List<MobileEvent> events) {
            final LinkedHashMap<String, EventMember> members =
                _distinctMembers(events);

            // Snap back to "All" if the selected member no longer appears.
            final String? effectiveMemberId = (_selectedMemberId != null &&
                    members.containsKey(_selectedMemberId))
                ? _selectedMemberId
                : null;

            final List<MobileEvent> filtered = effectiveMemberId == null
                ? events
                : events
                    .where((MobileEvent e) => e.member.id == effectiveMemberId)
                    .toList();

            return Column(
              children: <Widget>[
                _MemberFilterRow(
                  members: members,
                  selectedMemberId: effectiveMemberId,
                  l10n: l10n,
                  onSelected: (String? memberId) {
                    setState(() {
                      _selectedMemberId =
                          (memberId == _selectedMemberId) ? null : memberId;
                    });
                  },
                ),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _refresh,
                    child: _AgendaBody(
                      events: filtered,
                      from: _from,
                      to: _to,
                      l10n: l10n,
                      canLoadMore: _canLoadMore,
                      onLoadMore: _loadMore,
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Member filter chip row
// ---------------------------------------------------------------------------

class _MemberFilterRow extends StatelessWidget {
  const _MemberFilterRow({
    required this.members,
    required this.selectedMemberId,
    required this.l10n,
    required this.onSelected,
  });

  final LinkedHashMap<String, EventMember> members;
  final String? selectedMemberId;
  final AppL10n l10n;

  /// Called with the tapped member id, or null for "All".
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    final bool allSelected = selectedMemberId == null;
    final ColorScheme cs = Theme.of(context).colorScheme;

    return SizedBox(
      height: 56,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        children: <Widget>[
          // "All" chip
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: _FilterChip(
              label: l10n.calendarFilterAll,
              selected: allSelected,
              selectedColor: cs.primary,
              unselectedColor: cs.surfaceContainerHighest,
              selectedTextColor: cs.onPrimary,
              unselectedTextColor: cs.onSurface,
              borderColor: allSelected ? cs.primary : cs.outline,
              onTap: () => onSelected(null),
            ),
          ),
          // One chip per member
          ...members.values.map((EventMember member) {
            final bool selected = selectedMemberId == member.id;
            final Color accent = AccentPalette.resolve(member.color);
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _FilterChip(
                label: '${member.emoji} ${member.name}'.trim(),
                selected: selected,
                selectedColor: accent,
                unselectedColor: accent.withValues(alpha: 0.12),
                selectedTextColor: Colors.white,
                unselectedTextColor: accent,
                borderColor: selected ? accent : accent.withValues(alpha: 0.5),
                onTap: () => onSelected(member.id),
              ),
            );
          }),
        ],
      ),
    );
  }
}

/// A single pill-shaped chip used in the filter row.
class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.selectedColor,
    required this.unselectedColor,
    required this.selectedTextColor,
    required this.unselectedTextColor,
    required this.borderColor,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final Color selectedColor;
  final Color unselectedColor;
  final Color selectedTextColor;
  final Color unselectedTextColor;
  final Color borderColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final Color bg = selected ? selectedColor : unselectedColor;
    final Color textColor = selected ? selectedTextColor : unselectedTextColor;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        constraints: const BoxConstraints(minHeight: 44),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: borderColor),
        ),
        child: Center(
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: textColor,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  height: 1.2,
                ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

class _LoadingBody extends StatelessWidget {
  const _LoadingBody();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: const <Widget>[
        SizedBox(height: 120),
        Center(child: CircularProgressIndicator()),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({
    required this.error,
    required this.l10n,
    required this.onRetry,
    required this.onSessionExpired,
  });

  final Object error;
  final AppL10n l10n;
  final VoidCallback onRetry;
  final VoidCallback onSessionExpired;

  @override
  Widget build(BuildContext context) {
    final bool isRevoked = error is EventsSessionRevokedException;
    final bool isTooBroad = error is EventsRangeTooBroadException;
    final String message = isTooBroad
        ? l10n.calendarErrorRangeTooBroad
        : l10n.calendarErrorGeneric;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(24),
      children: <Widget>[
        const SizedBox(height: 40),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  isRevoked ? l10n.homeSessionExpired : message,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.error,
                      ),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: isRevoked ? onSessionExpired : onRetry,
                  child: Text(l10n.calendarErrorRetry),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Agenda body — grouped list
// ---------------------------------------------------------------------------

class _AgendaBody extends StatelessWidget {
  const _AgendaBody({
    required this.events,
    required this.from,
    required this.to,
    required this.l10n,
    required this.canLoadMore,
    required this.onLoadMore,
  });

  final List<MobileEvent> events;
  final DateTime from;
  final DateTime to;
  final AppL10n l10n;
  final bool canLoadMore;
  final VoidCallback onLoadMore;

  /// Groups events by their local start day. Returns ordered map.
  Map<DateTime, List<MobileEvent>> _groupByDay() {
    final Map<DateTime, List<MobileEvent>> groups =
        <DateTime, List<MobileEvent>>{};
    for (final MobileEvent e in events) {
      final DateTime key = e.groupDay;
      groups.putIfAbsent(key, () => <MobileEvent>[]).add(e);
    }
    // Sort within each group by startsAt.
    for (final List<MobileEvent> group in groups.values) {
      group.sort((MobileEvent a, MobileEvent b) {
        if (a.allDay && !b.allDay) {
          return -1;
        }
        if (!a.allDay && b.allDay) {
          return 1;
        }
        final DateTime? sa = a.startsAt;
        final DateTime? sb = b.startsAt;
        if (sa == null && sb == null) {
          return 0;
        }
        if (sa == null) {
          return -1;
        }
        if (sb == null) {
          return 1;
        }
        return sa.compareTo(sb);
      });
    }
    final List<DateTime> sortedKeys = groups.keys.toList()..sort();
    return Map<DateTime, List<MobileEvent>>.fromEntries(
      sortedKeys.map(
          (DateTime k) => MapEntry<DateTime, List<MobileEvent>>(k, groups[k]!)),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (events.isEmpty) {
      return _EmptyState(l10n: l10n);
    }

    final Map<DateTime, List<MobileEvent>> groups = _groupByDay();
    final List<DateTime> days = groups.keys.toList();

    // Build a flat list of items: [header, event, event, …, header, event, …]
    // plus a footer for "Load more".
    final List<_ListItem> items = <_ListItem>[];
    for (final DateTime day in days) {
      items.add(_DayHeaderItem(day: day));
      for (final MobileEvent event in groups[day]!) {
        items.add(_EventItem(event: event));
      }
    }

    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 24),
      itemCount: items.length + 1, // +1 for footer
      itemBuilder: (BuildContext context, int index) {
        if (index == items.length) {
          return _Footer(
            canLoadMore: canLoadMore,
            l10n: l10n,
            onLoadMore: onLoadMore,
          );
        }
        final _ListItem item = items[index];
        if (item is _DayHeaderItem) {
          return _DayHeader(day: item.day, l10n: l10n);
        }
        if (item is _EventItem) {
          return _EventRow(event: item.event, l10n: l10n);
        }
        return const SizedBox.shrink();
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Sealed list item types (avoids dynamic)
// ---------------------------------------------------------------------------

sealed class _ListItem {}

final class _DayHeaderItem extends _ListItem {
  _DayHeaderItem({required this.day});

  final DateTime day;
}

final class _EventItem extends _ListItem {
  _EventItem({required this.event});

  final MobileEvent event;
}

// ---------------------------------------------------------------------------
// Day header widget
// ---------------------------------------------------------------------------

class _DayHeader extends StatelessWidget {
  const _DayHeader({required this.day, required this.l10n});

  final DateTime day;
  final AppL10n l10n;

  bool _isToday(DateTime day) {
    final DateTime now = DateTime.now();
    return day.year == now.year && day.month == now.month && day.day == now.day;
  }

  @override
  Widget build(BuildContext context) {
    final String locale = Localizations.localeOf(context).toString();
    final String label = DateFormat('EEE, MMM d', locale).format(day);
    final bool today = _isToday(day);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 6),
      child: Row(
        children: <Widget>[
          Text(
            label,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: today
                      ? Theme.of(context).colorScheme.primary
                      : Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.7),
                ),
          ),
          if (today) ...<Widget>[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                l10n.calendarToday,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onPrimaryContainer,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Event row widget
// ---------------------------------------------------------------------------

class _EventRow extends StatelessWidget {
  const _EventRow({required this.event, required this.l10n});

  final MobileEvent event;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    final String locale = Localizations.localeOf(context).toString();
    // Prefer event.color override, fall back to member color.
    final Color accent =
        AccentPalette.resolve(event.color ?? event.member.color);

    final String timeLabel;
    if (event.allDay) {
      timeLabel = l10n.calendarAllDay;
    } else {
      final String start = event.startsAt != null
          ? DateFormat.Hm(locale).format(event.startsAt!.toLocal())
          : '';
      final String end = event.endsAt != null
          ? DateFormat.Hm(locale).format(event.endsAt!.toLocal())
          : '';
      timeLabel = '$start–$end';
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          // No-op tap for v2 — no detail view yet.
          onTap: () {},
          borderRadius: BorderRadius.circular(12),
          child: Container(
            constraints: const BoxConstraints(minHeight: 64),
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(12),
              border: Border(
                left: BorderSide(color: accent, width: 4),
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: <Widget>[
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          event.title,
                          style:
                              Theme.of(context).textTheme.bodyLarge?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                        ),
                        if (event.description != null &&
                            event.description!.isNotEmpty) ...<Widget>[
                          const SizedBox(height: 2),
                          Text(
                            event.description!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurface
                                      .withValues(alpha: 0.6),
                                ),
                          ),
                        ],
                        if (event.location != null &&
                            event.location!.isNotEmpty) ...<Widget>[
                          const SizedBox(height: 2),
                          Row(
                            children: <Widget>[
                              Icon(
                                Icons.location_on_outlined,
                                size: 13,
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurface
                                    .withValues(alpha: 0.5),
                              ),
                              const SizedBox(width: 2),
                              Expanded(
                                child: Text(
                                  event.location!,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodyMedium
                                      ?.copyWith(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onSurface
                                            .withValues(alpha: 0.5),
                                      ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    timeLabel,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: accent,
                      fontWeight: FontWeight.w600,
                      fontFeatures: const <FontFeature>[
                        FontFeature.tabularFigures(),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.l10n});

  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: <Widget>[
        const SizedBox(height: 80),
        Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(
                Icons.event_outlined,
                size: 56,
                color: Theme.of(context)
                    .colorScheme
                    .onSurface
                    .withValues(alpha: 0.25),
              ),
              const SizedBox(height: 16),
              Text(
                l10n.calendarEmpty,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.55),
                    ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 40),
                child: Text(
                  l10n.calendarEmptySubtitle,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context)
                            .colorScheme
                            .onSurface
                            .withValues(alpha: 0.4),
                      ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Footer — load more / cap indicator
// ---------------------------------------------------------------------------

class _Footer extends StatelessWidget {
  const _Footer({
    required this.canLoadMore,
    required this.l10n,
    required this.onLoadMore,
  });

  final bool canLoadMore;
  final AppL10n l10n;
  final VoidCallback onLoadMore;

  @override
  Widget build(BuildContext context) {
    if (!canLoadMore) {
      return const SizedBox(height: 24);
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: OutlinedButton.icon(
        onPressed: onLoadMore,
        icon: const Icon(Icons.expand_more),
        label: Text(l10n.calendarLoadMore),
      ),
    );
  }
}
