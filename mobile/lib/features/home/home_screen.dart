import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/mutations.dart';
import '../../models/session.dart';
import '../../models/today.dart';
import '../../services/fcm_service.dart';
import '../../services/heartbeat_service.dart';
import '../../services/today_service.dart';
import '../../state/session_provider.dart';
import '../../state/today_provider.dart';
import '../../theme.dart';
import '../../widgets/familyboard_logo.dart';

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
        actions: <Widget>[
          IconButton(
            icon: const Icon(Icons.sticky_note_2_outlined),
            tooltip: l10n.notesOpenAria,
            onPressed: () => context.go('/notes'),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(todayProvider);
            try {
              await ref.read(todayProvider.future);
            } catch (_) {}
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
                    onRetry: () => ref.invalidate(todayProvider),
                    onSessionExpired: () async {
                      await ref.read(sessionProvider.notifier).clear();
                    },
                  ),
                  data: (TodayPayload payload) => _TodayBody(
                    payload: payload,
                    session: session,
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

class _TodayBody extends ConsumerWidget {
  const _TodayBody({
    required this.payload,
    required this.session,
    required this.l10n,
  });

  final TodayPayload payload;
  final Session session;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _EventsCard(payload: payload, l10n: l10n),
        const SizedBox(height: 12),
        _ChoresCard(payload: payload, session: session, l10n: l10n),
        const SizedBox(height: 12),
        _TodosCard(payload: payload, session: session, l10n: l10n),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Events card (read-only — unchanged from M2.2a)
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
// Chores card — interactive
// ---------------------------------------------------------------------------

class _ChoresCard extends ConsumerWidget {
  const _ChoresCard({
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
      await ref.read(mutationsServiceProvider).completeChore(
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
                  widget.l10n.homePointsLabel(widget.chore.points),
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
// Todos card — interactive
// ---------------------------------------------------------------------------

class _TodosCard extends ConsumerStatefulWidget {
  const _TodosCard({
    required this.payload,
    required this.session,
    required this.l10n,
  });

  final TodayPayload payload;
  final Session session;
  final AppL10n l10n;

  @override
  ConsumerState<_TodosCard> createState() => _TodosCardState();
}

class _TodosCardState extends ConsumerState<_TodosCard> {
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
      ref.invalidate(todayProvider);
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
    final int open =
        widget.payload.todos.where((TodayTodo t) => !t.done).length;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              widget.l10n.homeTodosHeading(open),
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            if (widget.payload.todos.isEmpty)
              _EmptyState(message: widget.l10n.homeNoTodos)
            else
              ...widget.payload.todos.map(
                (TodayTodo todo) => _TodoRow(
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

  final TodayTodo todo;
  final Session session;
  final AppL10n l10n;

  @override
  ConsumerState<_TodoRow> createState() => _TodoRowState();
}

class _TodoRowState extends ConsumerState<_TodoRow> {
  bool _busy = false;
  bool _optimisticDone = false;
  bool _optimisticOverride = false;

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
      await ref.read(mutationsServiceProvider).toggleTodo(
            session: widget.session,
            id: widget.todo.id,
            done: newDone,
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
      // Silently drop.
      ref.invalidate(todayProvider);
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
      ref.invalidate(todayProvider);
    } on MutationSessionRevokedException {
      if (!mounted) {
        return;
      }
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
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
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
              if (duePill != null) ...<Widget>[
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
