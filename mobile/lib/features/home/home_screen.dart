import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../models/session.dart';
import '../../services/heartbeat_service.dart';
import '../../state/session_provider.dart';
import '../../theme.dart';

enum _HeartbeatStatus { idle, sending, done }

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  _HeartbeatStatus _status = _HeartbeatStatus.idle;
  DateTime? _lastSeenAt;
  String? _errorMessage;

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

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.appTitle),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
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
              const SizedBox(height: 24),
              _StubCard(title: l10n.homeTodayCard, message: l10n.homeComingSoon),
              const SizedBox(height: 12),
              _StubCard(title: l10n.homeChoresCard, message: l10n.homeComingSoon),
              const SizedBox(height: 12),
              _StubCard(title: l10n.homeTodosCard, message: l10n.homeComingSoon),
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
                onPressed:
                    _status == _HeartbeatStatus.sending ? null : _sendHeartbeat,
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
        color: accent.withOpacity(0.18),
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
                  color:
                      Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                ),
          ),
        ],
      ),
    );
  }
}

class _StubCard extends StatelessWidget {
  const _StubCard({required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(
              message,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withOpacity(0.6),
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
