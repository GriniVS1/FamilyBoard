import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/calendar_setup.dart';
import '../../models/session.dart';
import '../../services/calendar_setup_service.dart';
import '../../services/heartbeat_service.dart';
import '../../state/calendar_setup_provider.dart';
import '../../state/session_provider.dart';
import '../../widgets/familyboard_logo.dart';

enum _HeartbeatStatus { idle, sending, done }

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen>
    with WidgetsBindingObserver {
  _HeartbeatStatus _heartbeatStatus = _HeartbeatStatus.idle;
  DateTime? _lastSeenAt;
  String? _heartbeatError;

  bool _providerActionBusy = false;

  bool _caldavExpanded = false;
  CaldavPreset _preset = CaldavPreset.icloud;
  final TextEditingController _serverUrlController = TextEditingController();
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _caldavBusy = false;
  String? _caldavError;
  List<CaldavCalendarOption>? _caldavCalendars;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _serverUrlController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // A completed OAuth round-trip in the external browser has no way to
      // notify the app directly, so re-check status whenever we resume.
      ref.invalidate(calendarStatusProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsTitle)),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(calendarStatusProvider);
            try {
              await ref.read(calendarStatusProvider.future);
            } catch (_) {}
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            children: <Widget>[
              const FamilyBoardLogo(fontSize: 18),
              const SizedBox(height: 24),
              Text(
                l10n.settingsSectionDevice,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 12),
              _buildDeviceCard(l10n),
              const SizedBox(height: 24),
              Text(
                l10n.settingsSectionCalendar,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 12),
              _buildCalendarCard(l10n),
            ],
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Device section — heartbeat + disconnect
  // ---------------------------------------------------------------------------

  Widget _buildDeviceCard(AppL10n l10n) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _heartbeatStatusText(l10n),
            const SizedBox(height: 12),
            FilledButton.icon(
              icon: const Icon(Icons.favorite_outline),
              label: Text(
                _heartbeatStatus == _HeartbeatStatus.sending
                    ? l10n.homeHeartbeatPending
                    : l10n.homeHeartbeat,
              ),
              onPressed: _heartbeatStatus == _HeartbeatStatus.sending
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
    );
  }

  Widget _heartbeatStatusText(AppL10n l10n) {
    if (_heartbeatError != null) {
      return Text(
        _heartbeatError!,
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
    final Session? session = ref.read(sessionProvider).session;
    if (session == null) {
      return;
    }
    setState(() {
      _heartbeatStatus = _HeartbeatStatus.sending;
      _heartbeatError = null;
    });
    try {
      final HeartbeatResult result =
          await ref.read(heartbeatServiceProvider).send(session);
      if (!mounted) {
        return;
      }
      setState(() {
        _heartbeatStatus = _HeartbeatStatus.done;
        _lastSeenAt = result.lastSeenAt;
      });
    } on HeartbeatException catch (err) {
      if (!mounted) {
        return;
      }
      final AppL10n l10n = AppL10n.of(context);
      setState(() {
        _heartbeatStatus = _HeartbeatStatus.idle;
        _heartbeatError = switch (err.kind) {
          HeartbeatErrorKind.unauthorized => l10n.heartbeatErrorUnauthorized,
          HeartbeatErrorKind.network => l10n.pairErrorNetwork,
          HeartbeatErrorKind.unknown => l10n.pairErrorNetwork,
        };
      });
      if (err.kind == HeartbeatErrorKind.unauthorized) {
        await ref.read(sessionProvider.notifier).clear();
      }
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

  // ---------------------------------------------------------------------------
  // Calendar section
  // ---------------------------------------------------------------------------

  Widget _buildCalendarCard(AppL10n l10n) {
    final AsyncValue<CalendarStatus> statusAsync =
        ref.watch(calendarStatusProvider);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: statusAsync.when(
          loading: () => const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: CircularProgressIndicator(),
            ),
          ),
          error: (Object err, StackTrace _) => _buildCalendarError(l10n, err),
          data: (CalendarStatus status) => status.connected
              ? _buildConnectedCalendar(l10n, status)
              : _buildDisconnectedCalendar(l10n),
        ),
      ),
    );
  }

  Widget _buildCalendarError(AppL10n l10n, Object error) {
    if (error is CalendarSetupSessionRevokedException) {
      // Rebuilds will resolve to /pair once the session provider updates.
      Future<void>.microtask(
        () => ref.read(sessionProvider.notifier).clear(),
      );
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          l10n.calendarSetupLoadError,
          style: TextStyle(color: Theme.of(context).colorScheme.error),
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: () => ref.invalidate(calendarStatusProvider),
          child: Text(l10n.homeRetry),
        ),
      ],
    );
  }

  Widget _buildConnectedCalendar(AppL10n l10n, CalendarStatus status) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          _providerLabel(l10n, status.provider),
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 4),
        Text(
          status.accountLabel != null
              ? l10n.calendarSetupConnectedAs(status.accountLabel!)
              : l10n.calendarSetupNotConnected,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          icon: const Icon(Icons.link_off),
          label: Text(l10n.calendarSetupDisconnect),
          onPressed: _providerActionBusy ? null : _confirmDisconnectCalendar,
        ),
      ],
    );
  }

  Widget _buildDisconnectedCalendar(AppL10n l10n) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          l10n.calendarSetupNotConnected,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          icon: const Icon(Icons.event_outlined),
          label: Text(l10n.calendarSetupConnectGoogle),
          onPressed: _providerActionBusy ? null : _connectGoogle,
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          icon: const Icon(Icons.event_outlined),
          label: Text(l10n.calendarSetupConnectMicrosoft),
          onPressed: _providerActionBusy ? null : _connectMicrosoft,
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          icon: Icon(_caldavExpanded ? Icons.expand_less : Icons.expand_more),
          label: Text(l10n.calendarSetupConnectCaldavToggle),
          onPressed: () => setState(() => _caldavExpanded = !_caldavExpanded),
        ),
        if (_caldavExpanded) ...<Widget>[
          const SizedBox(height: 16),
          _buildCaldavForm(l10n),
        ],
      ],
    );
  }

  Widget _buildCaldavForm(AppL10n l10n) {
    if (_caldavCalendars != null) {
      return _buildCaldavCalendarPicker(l10n, _caldavCalendars!);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        DropdownButtonFormField<CaldavPreset>(
          initialValue: _preset,
          decoration: InputDecoration(
            labelText: l10n.calendarSetupCaldavPresetLabel,
          ),
          items: CaldavPreset.values
              .map(
                (CaldavPreset preset) => DropdownMenuItem<CaldavPreset>(
                  value: preset,
                  child: Text(_presetLabel(l10n, preset)),
                ),
              )
              .toList(),
          onChanged: _caldavBusy
              ? null
              : (CaldavPreset? value) {
                  if (value != null) {
                    setState(() => _preset = value);
                  }
                },
        ),
        if (_preset == CaldavPreset.custom) ...<Widget>[
          const SizedBox(height: 12),
          TextField(
            controller: _serverUrlController,
            enabled: !_caldavBusy,
            decoration: InputDecoration(
              labelText: l10n.calendarSetupCaldavServerUrlLabel,
            ),
          ),
        ],
        const SizedBox(height: 12),
        TextField(
          controller: _usernameController,
          enabled: !_caldavBusy,
          decoration: InputDecoration(
            labelText: l10n.calendarSetupCaldavUsernameLabel,
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _passwordController,
          enabled: !_caldavBusy,
          obscureText: true,
          decoration: InputDecoration(
            labelText: l10n.calendarSetupCaldavPasswordLabel,
          ),
        ),
        if (_caldavError != null) ...<Widget>[
          const SizedBox(height: 12),
          Text(
            _caldavError!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ],
        const SizedBox(height: 16),
        FilledButton(
          onPressed:
              _caldavBusy || !_caldavFormValid() ? null : _submitCaldavForm,
          child: _caldavBusy
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(l10n.calendarSetupCaldavSubmit),
        ),
      ],
    );
  }

  Widget _buildCaldavCalendarPicker(
    AppL10n l10n,
    List<CaldavCalendarOption> calendars,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          l10n.calendarSetupCaldavCalendarsHeading,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        ...calendars.map(
          (CaldavCalendarOption option) => Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              title: Text(option.name),
              trailing: _caldavBusy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.chevron_right),
              onTap: _caldavBusy ? null : () => _selectCaldavCalendar(option),
            ),
          ),
        ),
      ],
    );
  }

  bool _caldavFormValid() {
    if (_usernameController.text.trim().isEmpty) {
      return false;
    }
    if (_passwordController.text.isEmpty) {
      return false;
    }
    if (_preset == CaldavPreset.custom &&
        _serverUrlController.text.trim().isEmpty) {
      return false;
    }
    return true;
  }

  Future<void> _connectGoogle() async {
    final Session? session = ref.read(sessionProvider).session;
    if (session == null) {
      return;
    }
    setState(() => _providerActionBusy = true);
    try {
      final String url =
          await ref.read(calendarSetupServiceProvider).connectGoogle(session);
      await _launchAuthorizeUrl(url);
    } on CalendarSetupSessionRevokedException {
      await ref.read(sessionProvider.notifier).clear();
    } on CalendarSetupException catch (err) {
      _showCalendarError(err);
    } finally {
      if (mounted) {
        setState(() => _providerActionBusy = false);
      }
    }
  }

  Future<void> _connectMicrosoft() async {
    final Session? session = ref.read(sessionProvider).session;
    if (session == null) {
      return;
    }
    setState(() => _providerActionBusy = true);
    try {
      final String url = await ref
          .read(calendarSetupServiceProvider)
          .connectMicrosoft(session);
      await _launchAuthorizeUrl(url);
    } on CalendarSetupSessionRevokedException {
      await ref.read(sessionProvider.notifier).clear();
    } on CalendarSetupException catch (err) {
      _showCalendarError(err);
    } finally {
      if (mounted) {
        setState(() => _providerActionBusy = false);
      }
    }
  }

  Future<void> _launchAuthorizeUrl(String url) async {
    final Uri? uri = Uri.tryParse(url);
    bool launched = false;
    if (uri != null) {
      try {
        launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      } catch (_) {
        launched = false;
      }
    }
    if (!launched && mounted) {
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(AppL10n.of(context).calendarSetupLaunchError),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _submitCaldavForm() async {
    final Session? session = ref.read(sessionProvider).session;
    if (session == null) {
      return;
    }
    setState(() {
      _caldavBusy = true;
      _caldavError = null;
    });
    try {
      final List<CaldavCalendarOption> calendars =
          await ref.read(calendarSetupServiceProvider).connectCaldav(
                session,
                serverUrl: _preset == CaldavPreset.custom
                    ? _serverUrlController.text.trim()
                    : null,
                username: _usernameController.text.trim(),
                password: _passwordController.text,
                preset: _preset,
              );
      if (!mounted) {
        return;
      }
      setState(() => _caldavCalendars = calendars);
    } on CalendarSetupSessionRevokedException {
      await ref.read(sessionProvider.notifier).clear();
    } on CalendarSetupException catch (err) {
      if (!mounted) {
        return;
      }
      setState(() => _caldavError = _calendarErrorMessage(err));
    } finally {
      if (mounted) {
        setState(() => _caldavBusy = false);
      }
    }
  }

  Future<void> _selectCaldavCalendar(CaldavCalendarOption option) async {
    final Session? session = ref.read(sessionProvider).session;
    if (session == null) {
      return;
    }
    setState(() => _caldavBusy = true);
    try {
      await ref.read(calendarSetupServiceProvider).selectCaldavCalendar(
            session,
            calendarUrl: option.url,
            calendarName: option.name,
          );
      if (!mounted) {
        return;
      }
      setState(() {
        _caldavCalendars = null;
        _caldavExpanded = false;
        _usernameController.clear();
        _passwordController.clear();
      });
      ref.invalidate(calendarStatusProvider);
    } on CalendarSetupSessionRevokedException {
      await ref.read(sessionProvider.notifier).clear();
    } on CalendarSetupException catch (err) {
      if (!mounted) {
        return;
      }
      _showCalendarError(err);
    } finally {
      if (mounted) {
        setState(() => _caldavBusy = false);
      }
    }
  }

  Future<void> _confirmDisconnectCalendar() async {
    final AppL10n l10n = AppL10n.of(context);
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          content: Text(l10n.calendarSetupDisconnectConfirm),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(MaterialLocalizations.of(context).cancelButtonLabel),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: Text(l10n.calendarSetupDisconnect),
            ),
          ],
        );
      },
    );
    if (confirmed != true) {
      return;
    }
    final Session? session = ref.read(sessionProvider).session;
    if (session == null) {
      return;
    }
    setState(() => _providerActionBusy = true);
    try {
      await ref.read(calendarSetupServiceProvider).disconnect(session);
      if (!mounted) {
        return;
      }
      ref.invalidate(calendarStatusProvider);
    } on CalendarSetupSessionRevokedException {
      await ref.read(sessionProvider.notifier).clear();
    } on CalendarSetupException catch (err) {
      _showCalendarError(err);
    } finally {
      if (mounted) {
        setState(() => _providerActionBusy = false);
      }
    }
  }

  void _showCalendarError(CalendarSetupException err) {
    if (!mounted) {
      return;
    }
    scaffoldMessengerKey.currentState?.showSnackBar(
      SnackBar(
        content: Text(_calendarErrorMessage(err)),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  String _calendarErrorMessage(CalendarSetupException err) {
    final AppL10n l10n = AppL10n.of(context);
    switch (err.code) {
      case CalendarSetupErrorCode.providerConflict:
        return l10n.calendarSetupErrorProviderConflict;
      case CalendarSetupErrorCode.googleNotConfigured:
        return l10n.calendarSetupErrorGoogleNotConfigured;
      case CalendarSetupErrorCode.microsoftNotConfigured:
        return l10n.calendarSetupErrorMicrosoftNotConfigured;
      case CalendarSetupErrorCode.brokerUnreachable:
        return l10n.calendarSetupErrorBrokerUnreachable;
      case CalendarSetupErrorCode.unknown:
        return l10n.calendarSetupErrorGeneric;
    }
  }

  String _providerLabel(AppL10n l10n, CalendarProviderType? provider) {
    switch (provider) {
      case CalendarProviderType.google:
        return l10n.calendarSetupProviderGoogle;
      case CalendarProviderType.microsoft:
        return l10n.calendarSetupProviderMicrosoft;
      case CalendarProviderType.caldav:
        return l10n.calendarSetupProviderCaldav;
      case null:
        return l10n.calendarSetupNotConnected;
    }
  }

  String _presetLabel(AppL10n l10n, CaldavPreset preset) {
    switch (preset) {
      case CaldavPreset.icloud:
        return l10n.calendarSetupCaldavPresetIcloud;
      case CaldavPreset.fastmail:
        return l10n.calendarSetupCaldavPresetFastmail;
      case CaldavPreset.nextcloud:
        return l10n.calendarSetupCaldavPresetNextcloud;
      case CaldavPreset.yahoo:
        return l10n.calendarSetupCaldavPresetYahoo;
      case CaldavPreset.custom:
        return l10n.calendarSetupCaldavPresetCustom;
    }
  }
}
