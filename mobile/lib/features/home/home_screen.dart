import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../models/session.dart';
import '../../models/today.dart';
import '../../services/fcm_service.dart';
import '../../services/heartbeat_service.dart';
import '../../services/today_service.dart';
import '../../state/session_provider.dart';
import '../../widgets/familyboard_logo.dart';
import '../../state/today_provider.dart';
import '../../theme.dart';

enum _HeartbeatStatus { idle, sending, done }

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen>
    with WidgetsBindingObserver {
  _HeartbeatStatus _status = _HeartbeatStatus.idle;
  DateTime? _lastSeenAt;
  String? _errorMessage;
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

  /// When the user returns from system settings they may have toggled
  /// notification permission. Re-check and register if newly granted.
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
    final AsyncValue<TodayPayload> todayAsync = ref.watch(todayProvider);

    return Scaffold(
      appBar: AppBar(
        title: const FamilyBoardLogo(fontSize: 18),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(todayProvider);
            // Await the new value so the spinner stays visible until done.
            try {
              await ref.read(todayProvider.future);
            } catch (_) {
              // Error is displayed inline; no rethrow needed.
            }
          },
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
                todayAsync.when(
                  loading: () => const Center(
                    child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 48),
                      child: CircularProgressIndicator(),
                    ),
                  ),
                  error: (Object err, StackTrace _) => _ErrorBody(
                      error: err,
                      l10n: l10n,
                      onRetry: () {
                        ref.invalidate(todayProvider);
                      },
                      onSessionExpired: () async {
                        await ref.read(sessionProvider.notifier).clear();
                      }),
                  data: (TodayPayload payload) => _TodayBody(
                    payload: payload,
                    l10n: l10n,
                  ),
                ),
                const SizedBox(height: 32),
                _heartbeatStatusText(l10n),
                const SizedBox(height: 12),
                FilledButton.icon(
                  icon: const Icon(Icons.favorite_outline),
                  label: Text(
                    _status == _HeartbeatStatus.sending
                        ? l10n.homeHeartbeatPending
                        : l10n.homeHeartbeat,
                  ),
                  onPressed: _status == _HeartbeatStatus.sending
                      ? null
                      : _sendHeartbeat,
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  icon: const Icon(Icons.logout),
                  label: Text(l10n.homeDisconnect),
                  onPressed: _confirmDisconnect,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _heartbeatStatusText(AppL10n l10n) {
    if (_errorMessage != null) {
      return Text(
        _errorMessage!,
        style: TextStyle(color: Theme.of(context).colorScheme.error),
      );
    }
    if (_lastSeenAt != null) {
      final String formatted =
          DateFormat.Hm(Localizations.localeOf(context).toString())
              .format(_lastSeenAt!.toLocal());
      return Text(
        l10n.homeHeartbeatOk(formatted),
        style: Theme.of(context).textTheme.bodyMedium,
      );
    }
    return const SizedBox.shrink();
  }

  Future<void> _sendHeartbeat() async {
    final SessionState sessionState = ref.read(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return;
    }
    setState(() {
      _status = _HeartbeatStatus.sending;
      _errorMessage = null;
    });
    try {
      final HeartbeatResult result =
          await ref.read(heartbeatServiceProvider).send(session);
      if (!mounted) {
        return;
      }
      setState(() {
        _status = _HeartbeatStatus.done;
        _lastSeenAt = result.lastSeenAt;
      });
    } on HeartbeatException catch (err) {
      if (!mounted) {
        return;
      }
      setState(() {
        _status = _HeartbeatStatus.idle;
        _errorMessage = _heartbeatErrorMessage(err.kind);
      });
      if (err.kind == HeartbeatErrorKind.unauthorized) {
        await ref.read(sessionProvider.notifier).clear();
      }
    }
  }

  String _heartbeatErrorMessage(HeartbeatErrorKind kind) {
    final AppL10n l10n = AppL10n.of(context);
    switch (kind) {
      case HeartbeatErrorKind.unauthorized:
        return l10n.disconnectConfirm;
      case HeartbeatErrorKind.network:
        return l10n.pairErrorNetwork;
      case HeartbeatErrorKind.unknown:
        return l10n.pairErrorNetwork;
    }
  }

  Future<void> _confirmDisconnect() async {
    final AppL10n l10n = AppL10n.of(context);
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          content: Text(l10n.disconnectConfirm),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(MaterialLocalizations.of(context).cancelButtonLabel),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: Text(l10n.homeDisconnect),
            ),
          ],
        );
      },
    );
    if (confirmed == true) {
      await ref.read(sessionProvider.notifier).clear();
    }
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
    final bool isSessionError = error is TodaySessionRevokedException;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              isSessionError ? l10n.homeSessionExpired : l10n.homeLoadError,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                  ),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: isSessionError ? onSessionExpired : onRetry,
              child: Text(l10n.homeRetry),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Data body — three real cards
// ---------------------------------------------------------------------------

class _TodayBody extends StatelessWidget {
  const _TodayBody({required this.payload, required this.l10n});

  final TodayPayload payload;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _EventsCard(payload: payload, l10n: l10n),
        const SizedBox(height: 12),
        _ChoresCard(payload: payload, l10n: l10n),
        const SizedBox(height: 12),
        _TodosCard(payload: payload, l10n: l10n),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Events card
// ---------------------------------------------------------------------------

class _EventsCard extends StatelessWidget {
  const _EventsCard({required this.payload, required this.l10n});

  final TodayPayload payload;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    final String locale = Localizations.localeOf(context).toString();
    final String formattedDate =
        DateFormat.yMMMMEEEEd(locale).format(DateTime.parse(payload.todayIso));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              l10n.homeTodayHeading(formattedDate),
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            if (payload.events.isEmpty)
              _EmptyState(message: l10n.homeNoEvents)
            else
              ...payload.events.map(
                (TodayEvent event) => _EventRow(
                  event: event,
                  fallbackColor: payload.member.color,
                  l10n: l10n,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _EventRow extends StatelessWidget {
  const _EventRow({
    required this.event,
    required this.fallbackColor,
    required this.l10n,
  });

  final TodayEvent event;
  final String fallbackColor;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    final String locale = Localizations.localeOf(context).toString();
    final Color accent = AccentPalette.resolve(event.color ?? fallbackColor);

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
// Chores card
// ---------------------------------------------------------------------------

class _ChoresCard extends StatelessWidget {
  const _ChoresCard({required this.payload, required this.l10n});

  final TodayPayload payload;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    final int done =
        payload.chores.where((TodayChore c) => c.completedToday).length;
    final int total = payload.chores.length;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              l10n.homeChoresHeading(done, total),
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            if (payload.chores.isEmpty)
              _EmptyState(message: l10n.homeNoChores)
            else
              ...payload.chores.map(
                (TodayChore chore) => _ChoreRow(chore: chore, l10n: l10n),
              ),
          ],
        ),
      ),
    );
  }
}

class _ChoreRow extends StatelessWidget {
  const _ChoreRow({required this.chore, required this.l10n});

  final TodayChore chore;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    final bool done = chore.completedToday;
    final Color mutedColor =
        Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
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
            if (chore.icon != null && chore.icon!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(right: 10),
                child: Text(chore.icon!, style: const TextStyle(fontSize: 22)),
              ),
            Expanded(
              child: Text(
                chore.title,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: done ? mutedColor : null,
                      decoration: done ? TextDecoration.lineThrough : null,
                      decorationColor: mutedColor,
                    ),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
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
                l10n.homePointsLabel(chore.points),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: done
                          ? mutedColor
                          : Theme.of(context).colorScheme.onPrimaryContainer,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Todos card
// ---------------------------------------------------------------------------

class _TodosCard extends StatelessWidget {
  const _TodosCard({required this.payload, required this.l10n});

  final TodayPayload payload;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    final int open = payload.todos.where((TodayTodo t) => !t.done).length;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              l10n.homeTodosHeading(open),
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            if (payload.todos.isEmpty)
              _EmptyState(message: l10n.homeNoTodos)
            else
              ...payload.todos.map(
                (TodayTodo todo) => _TodoRow(todo: todo, l10n: l10n),
              ),
          ],
        ),
      ),
    );
  }
}

class _TodoRow extends StatelessWidget {
  const _TodoRow({required this.todo, required this.l10n});

  final TodayTodo todo;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    final bool done = todo.done;
    final Color mutedColor =
        Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4);
    final String? duePill = _duePill(todo.dueDate, l10n);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
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
            Padding(
              padding: const EdgeInsets.only(right: 10),
              child: Icon(
                done
                    ? Icons.check_circle_rounded
                    : Icons.radio_button_unchecked_rounded,
                color:
                    done ? mutedColor : Theme.of(context).colorScheme.primary,
                size: 22,
              ),
            ),
            Expanded(
              child: Text(
                todo.title,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: done ? mutedColor : null,
                      decoration: done ? TextDecoration.lineThrough : null,
                      decorationColor: mutedColor,
                    ),
              ),
            ),
            if (duePill != null) ...<Widget>[
              const SizedBox(width: 8),
              _DuePill(label: duePill, overdue: _isOverdue(todo.dueDate)),
            ],
          ],
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

// ---------------------------------------------------------------------------
// Notifications-disabled hint (subtle, below greeting)
// ---------------------------------------------------------------------------

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
