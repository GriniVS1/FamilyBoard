import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/event.dart';
import '../../models/mutations.dart';
import '../../models/note.dart';
import '../../models/session.dart';
import '../../models/today.dart';
import '../../models/todo_item.dart';
import '../../services/events_service.dart';
import '../../services/fcm_service.dart';
import '../../services/notes_service.dart';
import '../../services/today_service.dart';
import '../../services/todos_service.dart';
import '../../state/events_provider.dart';
import '../../state/notes_provider.dart';
import '../../state/session_provider.dart';
import '../../state/today_provider.dart';
import '../../state/todos_provider.dart';
import '../../theme.dart';
import '../../widgets/cached_at_pill.dart';
import '../../widgets/familyboard_logo.dart';
import '../../widgets/queue_badge.dart';

/// Local midnight today on the device.
DateTime _todayMidnight() {
  final DateTime now = DateTime.now();
  return DateTime(now.year, now.month, now.day);
}

/// Sort comparator for events that already share the same day: all-day
/// events first, then ascending by start time.
int _compareEventsWithinDay(MobileEvent a, MobileEvent b) {
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
}

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen>
    with WidgetsBindingObserver {
  bool _notificationsEnabled = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkAndReenrollFcm();
    }
  }

  Future<void> _checkAndReenrollFcm() async {
    final FcmService fcm = ref.read(fcmServiceProvider);
    final bool granted = await fcm.hasPermission();
    if (!mounted) {
      return;
    }
    setState(() => _notificationsEnabled = granted);
    if (granted) {
      final SessionState sessionState = ref.read(sessionProvider);
      final Session? session = sessionState.session;
      if (session == null) {
        return;
      }
      final String? token = await fcm.getToken();
      if (token != null) {
        await fcm.registerWithWall(session, token);
      }
    }
  }

  /// Today (inclusive) through +8 days — covers the Heute card (today) and
  /// the Demnächst card (the 7 days after today) from a single fetch.
  EventsRange _eventsRange() {
    final DateTime today = _todayMidnight();
    return EventsRange(from: today, to: today.add(const Duration(days: 8)));
  }

  Future<void> _refreshAll() async {
    final EventsRange range = _eventsRange();
    ref.invalidate(eventsProvider(range));
    ref.invalidate(todayProvider);
    ref.invalidate(todosProvider);
    ref.invalidate(notesProvider);
    // Kick every fetch off immediately, then await each independently so one
    // slow/failing card doesn't block the others from refreshing.
    final List<Future<void>> pending = <Future<void>>[
      ref.read(eventsProvider(range).future).then((_) {}),
      ref.read(todayProvider.future).then((_) {}),
      ref.read(todosProvider.future).then((_) {}),
      ref.read(notesProvider.future).then((_) {}),
    ];
    for (final Future<void> f in pending) {
      try {
        await f;
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final SessionState sessionState = ref.watch(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return Scaffold(
        body: Center(child: Text(l10n.splashLoading)),
      );
    }

    final Color accent = AccentPalette.resolve(session.member.color);
    final EventsRange range = _eventsRange();

    return Scaffold(
      appBar: AppBar(
        title: const FamilyBoardLogo(fontSize: 18),
        actions: <Widget>[
          if (session.activeUrl != null &&
              session.activeUrl == session.remoteUrl)
            Tooltip(
              message: l10n.remoteConnectionTooltip,
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8),
                child: Icon(Icons.cloud_outlined),
              ),
            ),
          const QueueBadge(),
          IconButton(
            icon: const Icon(Icons.restaurant_menu_outlined),
            tooltip: l10n.mealPlanOpenAria,
            onPressed: () => context.push('/meal-plan'),
          ),
          IconButton(
            icon: const Icon(Icons.event_outlined),
            tooltip: l10n.calendarOpenAria,
            onPressed: () => context.push('/calendar'),
          ),
          IconButton(
            icon: const Icon(Icons.sticky_note_2_outlined),
            tooltip: l10n.notesOpenAria,
            onPressed: () => context.push('/notes'),
          ),
          IconButton(
            icon: const Icon(Icons.shopping_cart_outlined),
            tooltip: l10n.groceryOpenAria,
            onPressed: () => context.push('/grocery'),
          ),
          IconButton(
            icon: const Icon(Icons.photo_library_outlined),
            tooltip: l10n.photosOpenAria,
            onPressed: () => context.push('/photos'),
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: l10n.settingsOpenAria,
            onPressed: () => context.push('/settings'),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refreshAll,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                _Greeting(
                  accent: accent,
                  emoji: session.member.emoji,
                  name: session.member.name,
                  family: session.family.name,
                  l10n: l10n,
                ),
                if (!_notificationsEnabled) ...<Widget>[
                  const SizedBox(height: 12),
                  _NotificationsDeniedHint(l10n: l10n),
                ],
                const SizedBox(height: 24),
                _HeuteCard(range: range, l10n: l10n),
                const SizedBox(height: 12),
                _DemnaechstCard(range: range, l10n: l10n),
                const SizedBox(height: 12),
                _ChoresCard(session: session, l10n: l10n),
                const SizedBox(height: 12),
                _TodosCard(session: session, l10n: l10n),
                const SizedBox(height: 12),
                _NotesCard(l10n: l10n),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared per-card loading / error states
// ---------------------------------------------------------------------------

class _CardLoading extends StatelessWidget {
  const _CardLoading();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(child: CircularProgressIndicator()),
      ),
    );
  }
}

class _CardError extends StatelessWidget {
  const _CardError({
    required this.isSessionExpired,
    required this.message,
    required this.l10n,
    required this.onRetry,
    required this.onSessionExpired,
  });

  final bool isSessionExpired;
  final String message;
  final AppL10n l10n;
  final VoidCallback onRetry;
  final VoidCallback onSessionExpired;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              isSessionExpired ? l10n.homeSessionExpired : message,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                  ),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: isSessionExpired ? onSessionExpired : onRetry,
              child: Text(l10n.homeRetry),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Heute card — family events happening today (read-only, tap → /calendar)
// ---------------------------------------------------------------------------

class _HeuteCard extends ConsumerWidget {
  const _HeuteCard({required this.range, required this.l10n});

  final EventsRange range;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<EventsResult> eventsAsync =
        ref.watch(eventsProvider(range));
    return eventsAsync.when(
      loading: () => const _CardLoading(),
      error: (Object err, StackTrace _) => _CardError(
        isSessionExpired: err is EventsSessionRevokedException,
        message: err is EventsRangeTooBroadException
            ? l10n.calendarErrorRangeTooBroad
            : l10n.homeLoadError,
        l10n: l10n,
        onRetry: () => ref.invalidate(eventsProvider(range)),
        onSessionExpired: () async {
          await ref.read(sessionProvider.notifier).clear();
        },
      ),
      data: (EventsResult result) {
        final DateTime today = _todayMidnight();
        final List<MobileEvent> todays = result.events
            .where((MobileEvent e) => e.groupDay == today)
            .toList()
          ..sort(_compareEventsWithinDay);
        return _HeuteCardBody(
          events: todays,
          staleAt: result.staleAt,
          l10n: l10n,
        );
      },
    );
  }
}

class _HeuteCardBody extends StatelessWidget {
  const _HeuteCardBody({
    required this.events,
    required this.staleAt,
    required this.l10n,
  });

  final List<MobileEvent> events;
  final DateTime? staleAt;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    final String locale = Localizations.localeOf(context).toString();
    final String formattedDate =
        DateFormat.yMMMMEEEEd(locale).format(DateTime.now());

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: () => context.push('/calendar'),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              if (staleAt != null) ...<Widget>[
                CachedAtPill(staleAt: staleAt),
                const SizedBox(height: 8),
              ],
              Text(
                l10n.homeTodayHeading(formattedDate),
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 12),
              if (events.isEmpty)
                _EmptyState(message: l10n.homeNoEvents)
              else
                ...events.map(
                  (MobileEvent event) =>
                      _HeuteEventRow(event: event, l10n: l10n),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeuteEventRow extends StatelessWidget {
  const _HeuteEventRow({required this.event, required this.l10n});

  final MobileEvent event;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    final String locale = Localizations.localeOf(context).toString();
    final Color accent =
        AccentPalette.resolve(event.color ?? event.member.color);

    String timeLabel;
    if (event.allDay) {
      timeLabel = l10n.homeAllDay;
    } else {
      final String start = event.startsAt != null
          ? DateFormat.Hm(locale).format(event.startsAt!.toLocal())
          : '';
      final String end = event.endsAt != null
          ? DateFormat.Hm(locale).format(event.endsAt!.toLocal())
          : '';
      timeLabel = '$start–$end';
    }

    final String memberLabel =
        '${event.member.emoji} ${event.member.name}'.trim();

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        constraints: const BoxConstraints(minHeight: 56),
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
          border: Border(
            left: BorderSide(color: accent, width: 4),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: <Widget>[
              Container(
                constraints: const BoxConstraints(minWidth: 72),
                child: Text(
                  timeLabel,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontFeatures: const <FontFeature>[
                      FontFeature.tabularFigures(),
                    ],
                    color: accent,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      event.title,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    if (event.location != null && event.location!.isNotEmpty)
                      Text(
                        event.location!,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurface
                                  .withValues(alpha: 0.6),
                            ),
                      ),
                    if (memberLabel.isNotEmpty) ...<Widget>[
                      const SizedBox(height: 2),
                      Text(
                        memberLabel,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurface
                                  .withValues(alpha: 0.5),
                            ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Demnächst card — next 7 days, up to 5 entries, hidden when empty
// ---------------------------------------------------------------------------

class _DemnaechstCard extends ConsumerWidget {
  const _DemnaechstCard({required this.range, required this.l10n});

  final EventsRange range;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<EventsResult> eventsAsync =
        ref.watch(eventsProvider(range));
    return eventsAsync.when(
      loading: () => const _CardLoading(),
      error: (Object err, StackTrace _) => _CardError(
        isSessionExpired: err is EventsSessionRevokedException,
        message: err is EventsRangeTooBroadException
            ? l10n.calendarErrorRangeTooBroad
            : l10n.homeLoadError,
        l10n: l10n,
        onRetry: () => ref.invalidate(eventsProvider(range)),
        onSessionExpired: () async {
          await ref.read(sessionProvider.notifier).clear();
        },
      ),
      data: (EventsResult result) {
        final DateTime today = _todayMidnight();
        final List<MobileEvent> upcoming = result.events
            .where((MobileEvent e) => e.groupDay.isAfter(today))
            .toList()
          ..sort((MobileEvent a, MobileEvent b) {
            final int dayCompare = a.groupDay.compareTo(b.groupDay);
            if (dayCompare != 0) {
              return dayCompare;
            }
            return _compareEventsWithinDay(a, b);
          });
        final List<MobileEvent> capped = upcoming.take(5).toList();
        if (capped.isEmpty) {
          return const SizedBox.shrink();
        }
        return _DemnaechstCardBody(events: capped, today: today, l10n: l10n);
      },
    );
  }
}

class _DemnaechstCardBody extends StatelessWidget {
  const _DemnaechstCardBody({
    required this.events,
    required this.today,
    required this.l10n,
  });

  final List<MobileEvent> events;
  final DateTime today;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    final String locale = Localizations.localeOf(context).toString();
    final DateTime tomorrow = today.add(const Duration(days: 1));

    // Group while preserving chronological order (events already sorted).
    final List<DateTime> orderedDays = <DateTime>[];
    final Map<DateTime, List<MobileEvent>> byDay =
        <DateTime, List<MobileEvent>>{};
    for (final MobileEvent e in events) {
      final DateTime day = e.groupDay;
      if (!byDay.containsKey(day)) {
        orderedDays.add(day);
        byDay[day] = <MobileEvent>[];
      }
      byDay[day]!.add(e);
    }

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: () => context.push('/calendar'),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  Text(
                    l10n.homeUpcomingHeading,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  TextButton(
                    style: TextButton.styleFrom(
                      minimumSize: const Size(48, 48),
                    ),
                    onPressed: () => context.push('/calendar'),
                    child: Text(l10n.homeSeeAll),
                  ),
                ],
              ),
              for (final DateTime day in orderedDays) ...<Widget>[
                Padding(
                  padding: const EdgeInsets.only(top: 4, bottom: 4),
                  child: Text(
                    day == tomorrow
                        ? l10n.homeUpcomingTomorrow
                        : DateFormat('EEE, d.M.', locale).format(day),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withValues(alpha: 0.6),
                        ),
                  ),
                ),
                ...byDay[day]!.map(
                  (MobileEvent e) => _UpcomingEventRow(event: e, l10n: l10n),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _UpcomingEventRow extends StatelessWidget {
  const _UpcomingEventRow({required this.event, required this.l10n});

  final MobileEvent event;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    final String locale = Localizations.localeOf(context).toString();
    final Color accent =
        AccentPalette.resolve(event.color ?? event.member.color);
    final String timeLabel = event.allDay
        ? l10n.homeAllDay
        : (event.startsAt != null
            ? DateFormat.Hm(locale).format(event.startsAt!.toLocal())
            : '');

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: <Widget>[
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 56,
            child: Text(
              timeLabel,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: accent,
                fontWeight: FontWeight.w600,
                fontFeatures: const <FontFeature>[
                  FontFeature.tabularFigures(),
                ],
              ),
            ),
          ),
          Expanded(
            child: Text(
              event.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          if (event.member.emoji.isNotEmpty) ...<Widget>[
            const SizedBox(width: 6),
            Text(event.member.emoji, style: const TextStyle(fontSize: 14)),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Chores card — interactive (Ämtli stays personal to the signed-in member)
// ---------------------------------------------------------------------------

class _ChoresCard extends ConsumerWidget {
  const _ChoresCard({required this.session, required this.l10n});

  final Session session;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<TodayPayload> todayAsync = ref.watch(todayProvider);
    return todayAsync.when(
      loading: () => const _CardLoading(),
      error: (Object err, StackTrace _) => _CardError(
        isSessionExpired: err is TodaySessionRevokedException,
        message: l10n.homeLoadError,
        l10n: l10n,
        onRetry: () => ref.invalidate(todayProvider),
        onSessionExpired: () async {
          await ref.read(sessionProvider.notifier).clear();
        },
      ),
      data: (TodayPayload payload) => _ChoresCardBody(
        payload: payload,
        session: session,
        l10n: l10n,
      ),
    );
  }
}

class _ChoresCardBody extends ConsumerWidget {
  const _ChoresCardBody({
    required this.payload,
    required this.session,
    required this.l10n,
  });

  final TodayPayload payload;
  final Session session;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final int done =
        payload.chores.where((TodayChore c) => c.completedToday).length;
    final int total = payload.chores.length;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            if (payload.staleAt != null) ...<Widget>[
              CachedAtPill(staleAt: payload.staleAt),
              const SizedBox(height: 8),
            ],
            Text(
              l10n.homeChoresHeading(done, total),
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            if (payload.chores.isEmpty)
              _EmptyState(message: l10n.homeNoChores)
            else
              ...payload.chores.map(
                (TodayChore chore) => _ChoreRow(
                  chore: chore,
                  session: session,
                  l10n: l10n,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ChoreRow extends ConsumerStatefulWidget {
  const _ChoreRow({
    required this.chore,
    required this.session,
    required this.l10n,
  });

  final TodayChore chore;
  final Session session;
  final AppL10n l10n;

  @override
  ConsumerState<_ChoreRow> createState() => _ChoreRowState();
}

class _ChoreRowState extends ConsumerState<_ChoreRow> {
  bool _busy = false;
  bool _optimisticDone = false;
  bool _optimisticOverride = false;
  bool _isQueued = false;

  bool get _isDone =>
      _optimisticOverride ? _optimisticDone : widget.chore.completedToday;

  Future<void> _handleTap(BuildContext context) async {
    if (_busy) {
      return;
    }

    if (_isDone) {
      await _handleUndo(context);
    } else {
      await _handleComplete(context);
    }
  }

  Future<void> _handleComplete(BuildContext context) async {
    final RenderBox? box = context.findRenderObject() as RenderBox?;
    final Offset center = box != null
        ? box.localToGlobal(box.size.center(Offset.zero))
        : Offset.zero;

    setState(() {
      _busy = true;
      _optimisticDone = true;
      _optimisticOverride = true;
    });

    StarBurstOverlay.show(context, center);

    try {
      final ChoreCompletionResult result =
          await ref.read(mutationsServiceProvider).completeChore(
                session: widget.session,
                id: widget.chore.id,
              );
      if (!mounted) {
        return;
      }
      // completionId == 'temp_pending' means the mutation was queued offline.
      if (result.completionId == 'temp_pending') {
        setState(() {
          _isQueued = true;
          _busy = false;
        });
        return;
      }
      ref.invalidate(todayProvider);
    } on MutationSessionRevokedException {
      if (!mounted) {
        return;
      }
      setState(() {
        _optimisticOverride = false;
        _busy = false;
      });
      await ref.read(sessionProvider.notifier).clear();
    } on MutationNotFoundException {
      if (!mounted) {
        return;
      }
      // Silently drop — the chore was removed from the wall.
      ref.invalidate(todayProvider);
    } on MutationFetchException {
      if (!mounted) {
        return;
      }
      setState(() {
        _optimisticOverride = false;
        _busy = false;
      });
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(widget.l10n.choresErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _handleUndo(BuildContext context) async {
    final AppL10n l10n = widget.l10n;
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) {
        return AlertDialog(
          content: Text(l10n.choresUndoConfirm),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(l10n.mutationErrorRetry),
            ),
          ],
        );
      },
    );
    if (confirmed != true) {
      return;
    }
    if (!mounted) {
      return;
    }

    setState(() {
      _busy = true;
      _optimisticDone = false;
      _optimisticOverride = true;
    });

    try {
      await ref.read(mutationsServiceProvider).undoChoreCompletion(
            session: widget.session,
            id: widget.chore.id,
          );
      if (!mounted) {
        return;
      }
      ref.invalidate(todayProvider);
    } on MutationSessionRevokedException {
      if (!mounted) {
        return;
      }
      setState(() {
        _optimisticOverride = false;
        _busy = false;
      });
      await ref.read(sessionProvider.notifier).clear();
    } on MutationNotFoundException {
      if (!mounted) {
        return;
      }
      ref.invalidate(todayProvider);
    } on MutationFetchException {
      if (!mounted) {
        return;
      }
      setState(() {
        _optimisticOverride = false;
        _busy = false;
      });
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(widget.l10n.choresErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool done = _isDone;
    final Color mutedColor =
        Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Opacity(
        opacity: _isQueued ? 0.6 : 1.0,
        child: InkWell(
          onTap: _busy ? null : () => _handleTap(context),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            constraints: const BoxConstraints(minHeight: 56),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: Theme.of(context).colorScheme.outline,
              ),
            ),
            child: Row(
              children: <Widget>[
                if (widget.chore.icon != null && widget.chore.icon!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(right: 10),
                    child: Text(
                      widget.chore.icon!,
                      style: const TextStyle(fontSize: 22),
                    ),
                  ),
                Expanded(
                  child: Text(
                    widget.chore.title,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: done ? mutedColor : null,
                          decoration: done ? TextDecoration.lineThrough : null,
                          decorationColor: mutedColor,
                        ),
                  ),
                ),
                const SizedBox(width: 8),
                if (_busy)
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else if (_isQueued)
                  Icon(
                    Icons.schedule,
                    size: 18,
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.4),
                  )
                else
                  Text(
                    done ? '★' : '☆',
                    style: TextStyle(
                      fontSize: 20,
                      color: done
                          ? const Color(0xFFFFD166)
                          : Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withValues(alpha: 0.3),
                    ),
                  ),
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: done
                        ? Theme.of(context)
                            .colorScheme
                            .outline
                            .withValues(alpha: 0.3)
                        : Theme.of(context).colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    widget.l10n.homePointsLabel(widget.chore.points),
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: done
                              ? mutedColor
                              : Theme.of(context)
                                  .colorScheme
                                  .onPrimaryContainer,
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                        ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Star-burst overlay animation
// ---------------------------------------------------------------------------

class StarBurstOverlay {
  StarBurstOverlay._();

  static void show(BuildContext context, Offset center) {
    final OverlayState overlay = Overlay.of(context);
    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (BuildContext ctx) => _StarBurstWidget(
        center: center,
        onDone: () => entry.remove(),
      ),
    );
    overlay.insert(entry);
  }
}

class _StarBurstWidget extends StatefulWidget {
  const _StarBurstWidget({required this.center, required this.onDone});

  final Offset center;
  final VoidCallback onDone;

  @override
  State<_StarBurstWidget> createState() => _StarBurstWidgetState();
}

class _StarBurstWidgetState extends State<_StarBurstWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  static const int _count = 8;
  static const double _radius = 80;
  static const List<String> _symbols = <String>[
    '★',
    '☆',
    '★',
    '★',
    '☆',
    '★',
    '★',
    '☆',
  ];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward().whenComplete(() {
        if (mounted) {
          widget.onDone();
        }
      });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (BuildContext ctx, Widget? child) {
        final double t = _controller.value;
        final double opacity = (1.0 - t).clamp(0.0, 1.0);
        return Stack(
          children: List<Widget>.generate(_count, (int i) {
            final double angle = (2 * math.pi / _count) * i;
            final double dx = math.cos(angle) * _radius * t;
            final double dy = math.sin(angle) * _radius * t;
            final double scale = (1.0 - t * 0.4).clamp(0.0, 1.0);
            return Positioned(
              left: widget.center.dx + dx - 12,
              top: widget.center.dy + dy - 12,
              child: Opacity(
                opacity: opacity,
                child: Transform.scale(
                  scale: scale,
                  child: Text(
                    _symbols[i % _symbols.length],
                    style: const TextStyle(
                      fontSize: 20,
                      color: Color(0xFFFFD166),
                    ),
                  ),
                ),
              ),
            );
          }),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Todos card — family-wide (interactive), member chip per row
// ---------------------------------------------------------------------------

class _TodosCard extends ConsumerWidget {
  const _TodosCard({required this.session, required this.l10n});

  final Session session;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<TodosResult> todosAsync = ref.watch(todosProvider);
    return todosAsync.when(
      loading: () => const _CardLoading(),
      error: (Object err, StackTrace _) => _CardError(
        isSessionExpired: err is TodosSessionRevokedException,
        message: l10n.homeLoadError,
        l10n: l10n,
        onRetry: () => ref.invalidate(todosProvider),
        onSessionExpired: () async {
          await ref.read(sessionProvider.notifier).clear();
        },
      ),
      data: (TodosResult result) => _TodosCardBody(
        todos: result.todos,
        staleAt: result.staleAt,
        session: session,
        l10n: l10n,
      ),
    );
  }
}

/// Todos beyond this count are hidden — there is no dedicated `/todos` screen
/// to link out to yet (see mobile M3.4/backend follow-ups).
const int _todosCardCap = 8;

class _TodosCardBody extends ConsumerStatefulWidget {
  const _TodosCardBody({
    required this.todos,
    required this.staleAt,
    required this.session,
    required this.l10n,
  });

  final List<TodoItem> todos;
  final DateTime? staleAt;
  final Session session;
  final AppL10n l10n;

  @override
  ConsumerState<_TodosCardBody> createState() => _TodosCardBodyState();
}

class _TodosCardBodyState extends ConsumerState<_TodosCardBody> {
  final TextEditingController _addController = TextEditingController();
  bool _addBusy = false;

  @override
  void dispose() {
    _addController.dispose();
    super.dispose();
  }

  Future<void> _submitNew() async {
    final String title = _addController.text.trim();
    if (title.isEmpty || _addBusy) {
      return;
    }
    setState(() => _addBusy = true);

    try {
      await ref.read(mutationsServiceProvider).createTodo(
            session: widget.session,
            title: title,
          );
      if (!mounted) {
        return;
      }
      _addController.clear();
      ref.invalidate(todosProvider);
    } on MutationSessionRevokedException {
      if (!mounted) {
        return;
      }
      await ref.read(sessionProvider.notifier).clear();
    } on MutationCapReachedException {
      if (!mounted) {
        return;
      }
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(widget.l10n.todosErrorTooMany),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on MutationFetchException {
      if (!mounted) {
        return;
      }
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(widget.l10n.todosErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _addBusy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final int open = widget.todos.where((TodoItem t) => !t.done).length;
    final List<TodoItem> visible = widget.todos.take(_todosCardCap).toList();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            if (widget.staleAt != null) ...<Widget>[
              CachedAtPill(staleAt: widget.staleAt),
              const SizedBox(height: 8),
            ],
            Text(
              widget.l10n.homeTodosHeading(open),
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            if (visible.isEmpty)
              _EmptyState(message: widget.l10n.homeNoTodos)
            else
              ...visible.map(
                (TodoItem todo) => _TodoRow(
                  todo: todo,
                  session: widget.session,
                  l10n: widget.l10n,
                ),
              ),
            const SizedBox(height: 8),
            _AddTodoRow(
              controller: _addController,
              busy: _addBusy,
              l10n: widget.l10n,
              onSubmit: _submitNew,
            ),
          ],
        ),
      ),
    );
  }
}

class _AddTodoRow extends StatelessWidget {
  const _AddTodoRow({
    required this.controller,
    required this.busy,
    required this.l10n,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final bool busy;
  final AppL10n l10n;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(
          child: TextField(
            controller: controller,
            enabled: !busy,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => onSubmit(),
            decoration: InputDecoration(
              hintText: l10n.todosAddPlaceholder,
              isDense: true,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          height: 48,
          width: 48,
          child: busy
              ? const Center(
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : IconButton.filled(
                  icon: const Icon(Icons.add),
                  tooltip: l10n.todosAddButton,
                  onPressed: onSubmit,
                ),
        ),
      ],
    );
  }
}

class _TodoRow extends ConsumerStatefulWidget {
  const _TodoRow({
    required this.todo,
    required this.session,
    required this.l10n,
  });

  final TodoItem todo;
  final Session session;
  final AppL10n l10n;

  @override
  ConsumerState<_TodoRow> createState() => _TodoRowState();
}

class _TodoRowState extends ConsumerState<_TodoRow> {
  bool _busy = false;
  bool _optimisticDone = false;
  bool _optimisticOverride = false;
  bool _isQueued = false;

  bool get _isDone => _optimisticOverride ? _optimisticDone : widget.todo.done;

  Future<void> _toggle() async {
    if (_busy) {
      return;
    }
    final bool newDone = !_isDone;
    setState(() {
      _busy = true;
      _optimisticDone = newDone;
      _optimisticOverride = true;
    });

    try {
      final TodoMutation result =
          await ref.read(mutationsServiceProvider).toggleTodo(
                session: widget.session,
                id: widget.todo.id,
                done: newDone,
              );
      if (!mounted) {
        return;
      }
      // An empty title signals a queued synthetic result.
      if (result.title.isEmpty) {
        setState(() {
          _isQueued = true;
          _busy = false;
        });
        return;
      }
      ref.invalidate(todosProvider);
    } on MutationSessionRevokedException {
      if (!mounted) {
        return;
      }
      setState(() {
        _optimisticOverride = false;
        _busy = false;
      });
      await ref.read(sessionProvider.notifier).clear();
    } on MutationNotFoundException {
      if (!mounted) {
        return;
      }
      // Silently drop.
      ref.invalidate(todosProvider);
    } on MutationFetchException {
      if (!mounted) {
        return;
      }
      setState(() {
        _optimisticDone = !newDone;
        _optimisticOverride = true;
        _busy = false;
      });
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(widget.l10n.todosErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _delete() async {
    final AppL10n l10n = widget.l10n;
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) {
        return AlertDialog(
          content: Text(l10n.todosDeleteConfirm),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(l10n.todosDeleteConfirm),
            ),
          ],
        );
      },
    );
    if (confirmed != true || !mounted) {
      return;
    }

    try {
      await ref.read(mutationsServiceProvider).deleteTodo(
            session: widget.session,
            id: widget.todo.id,
          );
      if (!mounted) {
        return;
      }
      ref.invalidate(todosProvider);
    } on MutationSessionRevokedException {
      if (!mounted) {
        return;
      }
      await ref.read(sessionProvider.notifier).clear();
    } on MutationNotFoundException {
      if (!mounted) {
        return;
      }
      ref.invalidate(todosProvider);
    } on MutationFetchException {
      if (!mounted) {
        return;
      }
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(widget.l10n.todosErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool done = _isDone;
    final Color mutedColor =
        Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4);
    final String? duePill = _duePill(widget.todo.dueDate, widget.l10n);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Opacity(
        opacity: _isQueued ? 0.6 : 1.0,
        child: InkWell(
          onTap: _busy ? null : _toggle,
          onLongPress: _busy ? null : _delete,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            constraints: const BoxConstraints(minHeight: 56),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: Theme.of(context).colorScheme.outline,
              ),
            ),
            child: Row(
              children: <Widget>[
                GestureDetector(
                  onTap: _busy ? null : _toggle,
                  behavior: HitTestBehavior.opaque,
                  child: Padding(
                    padding: const EdgeInsets.only(right: 10),
                    child: SizedBox(
                      width: 32,
                      height: 32,
                      child: _busy
                          ? const Center(
                              child: SizedBox(
                                width: 18,
                                height: 18,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              ),
                            )
                          : _isQueued
                              ? Icon(
                                  Icons.schedule,
                                  size: 20,
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurface
                                      .withValues(alpha: 0.4),
                                )
                              : Icon(
                                  done
                                      ? Icons.check_circle_rounded
                                      : Icons.radio_button_unchecked_rounded,
                                  color: done
                                      ? mutedColor
                                      : Theme.of(context).colorScheme.primary,
                                  size: 24,
                                ),
                    ),
                  ),
                ),
                if (widget.todo.member != null) ...<Widget>[
                  _TodoMemberChip(member: widget.todo.member!),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: Text(
                    widget.todo.title,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: done ? mutedColor : null,
                          decoration: done ? TextDecoration.lineThrough : null,
                          decorationColor: mutedColor,
                        ),
                  ),
                ),
                if (_isQueued) ...<Widget>[
                  const SizedBox(width: 4),
                  Text(
                    AppL10n.of(context).queuedRow,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withValues(alpha: 0.4),
                          fontSize: 11,
                        ),
                  ),
                ] else if (duePill != null) ...<Widget>[
                  const SizedBox(width: 8),
                  _DuePill(
                    label: duePill,
                    overdue: _isOverdue(widget.todo.dueDate),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  String? _duePill(DateTime? dueDate, AppL10n l10n) {
    if (dueDate == null) {
      return null;
    }
    final DateTime now = DateTime.now();
    final DateTime today = DateTime(now.year, now.month, now.day);
    final DateTime due = DateTime(dueDate.year, dueDate.month, dueDate.day);
    final int diff = due.difference(today).inDays;
    if (diff == 0) {
      return l10n.homeDueToday;
    }
    if (diff == 1) {
      return l10n.homeDueTomorrow;
    }
    if (diff < 0) {
      return l10n.homeOverdue(
        DateFormat('EEE d.M').format(dueDate.toLocal()),
      );
    }
    return l10n.homeDueOn(DateFormat('EEE d.M').format(dueDate.toLocal()));
  }

  bool _isOverdue(DateTime? dueDate) {
    if (dueDate == null) {
      return false;
    }
    final DateTime now = DateTime.now();
    final DateTime today = DateTime(now.year, now.month, now.day);
    final DateTime due = DateTime(dueDate.year, dueDate.month, dueDate.day);
    return due.isBefore(today);
  }
}

class _TodoMemberChip extends StatelessWidget {
  const _TodoMemberChip({required this.member});

  final TodoMember member;

  @override
  Widget build(BuildContext context) {
    final Color accent = AccentPalette.resolve(member.color);
    final String label = member.emoji.isNotEmpty
        ? member.emoji
        : (member.name.isNotEmpty ? member.name[0].toUpperCase() : '?');
    return Tooltip(
      message: member.name,
      child: Container(
        width: 24,
        height: 24,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.25),
          shape: BoxShape.circle,
          border: Border.all(color: accent, width: 1.5),
        ),
        child: Text(label, style: const TextStyle(fontSize: 12)),
      ),
    );
  }
}

class _DuePill extends StatelessWidget {
  const _DuePill({required this.label, required this.overdue});

  final String label;
  final bool overdue;

  @override
  Widget build(BuildContext context) {
    final Color bg = overdue
        ? Theme.of(context).colorScheme.errorContainer
        : Theme.of(context).colorScheme.secondaryContainer;
    final Color fg = overdue
        ? Theme.of(context).colorScheme.onErrorContainer
        : Theme.of(context).colorScheme.onSecondaryContainer;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: fg,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Notizen card — latest 3 sticky notes, hidden when empty (tap → /notes)
// ---------------------------------------------------------------------------

class _NotesCard extends ConsumerWidget {
  const _NotesCard({required this.l10n});

  final AppL10n l10n;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<NotesResult> notesAsync = ref.watch(notesProvider);
    return notesAsync.when(
      loading: () => const _CardLoading(),
      error: (Object err, StackTrace _) => _CardError(
        isSessionExpired: err is NoteSessionRevokedException,
        message: l10n.homeLoadError,
        l10n: l10n,
        onRetry: () => ref.invalidate(notesProvider),
        onSessionExpired: () async {
          await ref.read(sessionProvider.notifier).clear();
        },
      ),
      data: (NotesResult result) {
        final List<Note> sorted = <Note>[...result.notes]
          ..sort((Note a, Note b) => b.createdAt.compareTo(a.createdAt));
        final List<Note> latest = sorted.take(3).toList();
        if (latest.isEmpty) {
          return const SizedBox.shrink();
        }
        return _NotesCardBody(notes: latest, l10n: l10n);
      },
    );
  }
}

class _NotesCardBody extends StatelessWidget {
  const _NotesCardBody({required this.notes, required this.l10n});

  final List<Note> notes;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: () => context.push('/notes'),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  Text(
                    l10n.notesTitle,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Icon(
                    Icons.chevron_right,
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.4),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ...notes.map(
                (Note note) => _HomeNoteRow(note: note, l10n: l10n),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeNoteRow extends StatelessWidget {
  const _HomeNoteRow({required this.note, required this.l10n});

  final Note note;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    final Color accent = AccentPalette.resolve(note.color);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        constraints: const BoxConstraints(minHeight: 48),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
          border: Border(
            left: BorderSide(color: accent, width: 4),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              note.body,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            if (note.author != null) ...<Widget>[
              const SizedBox(height: 4),
              Text(
                l10n.notesByAuthor(note.author!.name),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.5),
                    ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared widgets
// ---------------------------------------------------------------------------

class _Greeting extends StatelessWidget {
  const _Greeting({
    required this.accent,
    required this.emoji,
    required this.name,
    required this.family,
    required this.l10n,
  });

  final Color accent;
  final String emoji;
  final String name;
  final String family;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(24),
        border: Border(
          left: BorderSide(color: accent, width: 4),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            l10n.homeGreeting(emoji, name),
            style: Theme.of(context).textTheme.displaySmall,
          ),
          const SizedBox(height: 4),
          Text(
            l10n.homeFamily(family),
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Theme.of(context)
                      .colorScheme
                      .onSurface
                      .withValues(alpha: 0.7),
                ),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Text(
        message,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.6),
            ),
      ),
    );
  }
}

class _NotificationsDeniedHint extends StatelessWidget {
  const _NotificationsDeniedHint({required this.l10n});

  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Icon(
          Icons.notifications_off_outlined,
          size: 16,
          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4),
        ),
        const SizedBox(width: 6),
        Text(
          l10n.pushPermissionDeniedHint,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context)
                    .colorScheme
                    .onSurface
                    .withValues(alpha: 0.4),
              ),
        ),
      ],
    );
  }
}
