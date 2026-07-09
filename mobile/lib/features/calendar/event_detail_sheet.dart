import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/event.dart';
import '../../models/session.dart';
import '../../services/events_service.dart';
import '../../state/events_provider.dart';
import '../../state/session_provider.dart';
import '../../theme.dart';
import 'event_edit_sheet.dart';
import 'event_shared.dart';

/// Opens [EventDetailSheet] as a modal bottom sheet.
Future<void> showEventDetailSheet(BuildContext context, MobileEvent event) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (BuildContext ctx) => EventDetailSheet(event: event),
  );
}

class EventDetailSheet extends ConsumerStatefulWidget {
  const EventDetailSheet({super.key, required this.event});

  final MobileEvent event;

  @override
  ConsumerState<EventDetailSheet> createState() => _EventDetailSheetState();
}

class _EventDetailSheetState extends ConsumerState<EventDetailSheet> {
  bool _busy = false;

  bool get _isRecurring => widget.event.isRecurringInstance;

  bool get _isReadOnlySource =>
      widget.event.source == 'GOOGLE' || widget.event.source == 'MICROSOFT';

  Future<void> _edit() async {
    final AppL10n l10n = AppL10n.of(context);
    final String? scope =
        _isRecurring ? await askEventScope(context, l10n) : 'series';
    if (scope == null || !mounted) {
      return;
    }
    await showEventEditSheet(
      context,
      event: widget.event,
      readOnlyCore: _isReadOnlySource,
      scope: scope,
    );
    if (!mounted) {
      return;
    }
    Navigator.of(context).pop();
  }

  Future<String?> _confirmSimpleDelete(AppL10n l10n) async {
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        content: Text(l10n.calendarDeleteConfirm),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.calendarEventDelete),
          ),
        ],
      ),
    );
    return confirmed == true ? 'series' : null;
  }

  Future<void> _delete() async {
    final AppL10n l10n = AppL10n.of(context);
    final String? scope = _isRecurring
        ? await askEventScope(context, l10n)
        : await _confirmSimpleDelete(l10n);
    if (scope == null || !mounted) {
      return;
    }

    final SessionState sessionState = ref.read(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(eventsServiceProvider).deleteEvent(
            session: session,
            id: widget.event.id,
            scope: scope,
          );
      if (!mounted) {
        return;
      }
      ref.invalidate(eventsProvider);
      Navigator.of(context).pop();
    } on EventsSessionRevokedException {
      if (!mounted) {
        return;
      }
      await ref.read(sessionProvider.notifier).clear();
    } on EventsWriteException catch (err) {
      if (!mounted) {
        return;
      }
      if (err.code == EventWriteErrorCode.notFound) {
        ref.invalidate(eventsProvider);
        Navigator.of(context).pop();
        return;
      }
      setState(() => _busy = false);
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(eventWriteErrorMessage(l10n, err.code)),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final MobileEvent event = widget.event;
    final String locale = Localizations.localeOf(context).toString();
    final Color accent =
        AccentPalette.resolve(event.color ?? event.member.color);

    final String timeLabel;
    if (event.allDay) {
      timeLabel = l10n.calendarAllDay;
    } else {
      final String start = event.startsAt != null
          ? DateFormat.yMMMd(locale).add_Hm().format(event.startsAt!.toLocal())
          : '';
      final String end = event.endsAt != null
          ? DateFormat.Hm(locale).format(event.endsAt!.toLocal())
          : '';
      timeLabel = '$start – $end';
    }

    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Container(
                  width: 12,
                  height: 12,
                  decoration:
                      BoxDecoration(color: accent, shape: BoxShape.circle),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  event.title,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
              ),
              if (_isRecurring)
                Icon(
                  Icons.repeat,
                  size: 20,
                  color: Theme.of(context).colorScheme.onSurface.withValues(
                        alpha: 0.4,
                      ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(timeLabel, style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 4),
          Text(
            '${event.member.emoji} ${event.member.name}'.trim(),
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          if (event.location != null && event.location!.isNotEmpty) ...<Widget>[
            const SizedBox(height: 8),
            Row(
              children: <Widget>[
                const Icon(Icons.location_on_outlined, size: 16),
                const SizedBox(width: 4),
                Expanded(child: Text(event.location!)),
              ],
            ),
          ],
          if (event.description != null &&
              event.description!.isNotEmpty) ...<Widget>[
            const SizedBox(height: 8),
            Text(event.description!),
          ],
          if (_isReadOnlySource) ...<Widget>[
            const SizedBox(height: 12),
            EventReadOnlyBanner(source: event.source, l10n: l10n),
          ],
          const SizedBox(height: 20),
          Row(
            children: <Widget>[
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.edit_outlined),
                  label: Text(l10n.calendarEventEdit),
                  onPressed: _busy ? null : _edit,
                ),
              ),
              if (!_isReadOnlySource) ...<Widget>[
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.tonalIcon(
                    icon: const Icon(Icons.delete_outline),
                    label: Text(l10n.calendarEventDelete),
                    onPressed: _busy ? null : _delete,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
