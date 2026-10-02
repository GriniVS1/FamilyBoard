import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app.dart';
import '../../kids/kid_scroll_guard.dart';
import '../../kids/undo_toast.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/event.dart';
import '../../models/mutations.dart';
import '../../models/note.dart';
import '../../models/session.dart';
import '../../models/todo_item.dart';
import '../../models/todo_sort.dart';
import '../../services/events_service.dart';
import '../../services/fcm_service.dart';
import '../../services/notes_service.dart';
import '../../services/todos_service.dart';
import '../../state/data_refresh.dart';
import '../../state/events_provider.dart';
import '../../state/home_range_provider.dart';
import '../../state/notes_provider.dart';
import '../../state/session_provider.dart';
import '../../state/todos_provider.dart';
import '../../theme.dart';
import '../../widgets/cached_at_pill.dart';
import '../../widgets/adaptive_layout.dart';
import '../../widgets/familyboard_logo.dart';
import '../../widgets/queue_badge.dart';
import '../../widgets/todo_composer.dart';
import '../../widgets/todo_row.dart';
import 'kid_home_chores.dart';
import 'kid_today_events.dart';

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

  /// Pull-to-refresh — uses the same provider set as resume-refresh and
  /// foreground polling (see `state/data_refresh.dart`), with futures
  /// awaited so `RefreshIndicator` knows when to stop spinning. Reads
  /// [currentHomeRangeProvider] rather than recomputing a range so this
  /// always targets exactly the instance the widget tree below is watching.
  Future<void> _refreshAll() async {
    await refreshVisibleData(
      range: ref.read(currentHomeRangeProvider),
      invalidate: ref.invalidate,
      read: ref.read,
    );
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final SessionState sessionState = ref.watch(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return Scaffold(body: Center(child: Text(l10n.splashLoading)));
    }

    final Color accent = AccentPalette.resolve(session.member.color);
    // Watched (not read) so a midnight rollover — handled internally by
    // HomeRangeNotifier's own timer, independent of any lifecycle event —
    // rebuilds this screen with the corrected window.
    final EventsRange range = ref.watch(currentHomeRangeProvider);

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
        ],
      ),
      body: SafeArea(
        child: ConstrainedContent(
          child: KidScrollGuard(
            listKey: kHomeListKey,
            child: RefreshIndicator(
              onRefresh: _refreshAll,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(
                  16,
                  16,
                  16,
                  kToastListPadding,
                ),
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
                    KidHomeChoresCard(session: session),
                    const SizedBox(height: 12),
                    KidTodayEventsCard(range: range),
                    const SizedBox(height: 12),
                    _DemnaechstCard(range: range, l10n: l10n),
                    const SizedBox(height: 12),
                    _TodosCard(session: session, l10n: l10n),
                    const SizedBox(height: 12),
                    _NotesCard(l10n: l10n),
                  ],
                ),
              ),
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
// Demnächst card — next 7 days, up to 5 entries, hidden when empty
// ---------------------------------------------------------------------------

class _DemnaechstCard extends ConsumerWidget {
  const _DemnaechstCard({required this.range, required this.l10n});

  final EventsRange range;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<EventsResult> eventsAsync = ref.watch(
      eventsProvider(range),
    );
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
        final List<MobileEvent> upcoming =
            result.events
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
                      color: Theme.of(
                        context,
                      ).colorScheme.onSurface.withValues(alpha: 0.6),
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
    final Color accent = AccentPalette.resolve(
      event.color ?? event.member.color,
    );
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
                fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
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

/// Todos beyond this count are hidden — the full family list is one tap away
/// via the "Alle anzeigen" link, which pushes the To-dos screen (`/todos`).
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
  DateTime? _addDueDate;

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
      await ref
          .read(mutationsServiceProvider)
          .createTodo(
            session: widget.session,
            title: title,
            dueDate: _addDueDate,
          );
      if (!mounted) {
        return;
      }
      _addController.clear();
      setState(() => _addDueDate = null);
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
    // Re-sorted by due date within the API's done/not-done partitions (see
    // `sortTodosForDisplay`) before the dashboard cap is applied, so an
    // overdue or due-today item near the bottom of the family list still
    // surfaces on Home.
    final List<TodoItem> visible = sortTodosForDisplay(
      widget.todos,
    ).take(_todosCardCap).toList();

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
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: <Widget>[
                Expanded(
                  child: Text(
                    widget.l10n.homeTodosHeading(open),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                TextButton(
                  style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
                  onPressed: () => context.push('/todos'),
                  child: Text(widget.l10n.homeSeeAll),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (visible.isEmpty)
              _EmptyState(message: widget.l10n.homeNoTodos)
            else
              ...visible.map(
                (TodoItem todo) => TodoRow(
                  todo: todo,
                  session: widget.session,
                  l10n: widget.l10n,
                ),
              ),
            const SizedBox(height: 8),
            TodoComposerRow(
              controller: _addController,
              busy: _addBusy,
              l10n: widget.l10n,
              dueDate: _addDueDate,
              onDueDateChanged: (DateTime? d) =>
                  setState(() => _addDueDate = d),
              onSubmit: _submitNew,
            ),
          ],
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
                    color: Theme.of(
                      context,
                    ).colorScheme.onSurface.withValues(alpha: 0.4),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ...notes.map((Note note) => _HomeNoteRow(note: note, l10n: l10n)),
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
          border: Border(left: BorderSide(color: accent, width: 4)),
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
                  color: Theme.of(
                    context,
                  ).colorScheme.onSurface.withValues(alpha: 0.5),
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
        border: Border(left: BorderSide(color: accent, width: 4)),
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
              color: Theme.of(
                context,
              ).colorScheme.onSurface.withValues(alpha: 0.7),
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
          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
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
            color: Theme.of(
              context,
            ).colorScheme.onSurface.withValues(alpha: 0.4),
          ),
        ),
      ],
    );
  }
}
