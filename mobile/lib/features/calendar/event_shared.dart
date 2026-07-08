import 'package:flutter/material.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../services/events_service.dart';

/// Banner shown in the event editor/detail sheet for GOOGLE/MICROSOFT-sourced
/// events, which are read-only on the wall except for member + color.
class EventReadOnlyBanner extends StatelessWidget {
  const EventReadOnlyBanner({
    super.key,
    required this.source,
    required this.l10n,
  });

  final String source;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    final String provider = source == 'MICROSOFT'
        ? l10n.calendarSetupProviderMicrosoft
        : l10n.calendarSetupProviderGoogle;
    final ColorScheme cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cs.secondaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: <Widget>[
          Icon(Icons.lock_outline, size: 18, color: cs.onSecondaryContainer),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              l10n.calendarEventReadOnlyBanner(provider),
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: cs.onSecondaryContainer,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Maps an [EventsWriteException.code] to a localized message.
String eventWriteErrorMessage(AppL10n l10n, EventWriteErrorCode code) {
  switch (code) {
    case EventWriteErrorCode.googleReadOnly:
      return l10n.calendarErrorGoogleReadOnly;
    case EventWriteErrorCode.microsoftReadOnly:
      return l10n.calendarErrorMicrosoftReadOnly;
    case EventWriteErrorCode.overrideNotSupported:
      return l10n.calendarErrorOverrideNotSupported;
    case EventWriteErrorCode.notFound:
      return l10n.calendarErrorEventNotFound;
    case EventWriteErrorCode.unknown:
      return l10n.calendarErrorSaveGeneric;
  }
}

/// Asks the user whether a recurring-event edit/delete should apply to just
/// this occurrence or the whole series. Returns `'instance'`, `'series'`, or
/// null if cancelled.
Future<String?> askEventScope(BuildContext context, AppL10n l10n) {
  return showDialog<String>(
    context: context,
    builder: (BuildContext ctx) => AlertDialog(
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            l10n.calendarScopeQuestion,
            style: Theme.of(ctx).textTheme.titleMedium,
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop('instance'),
            child: Text(l10n.calendarScopeInstance),
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop('series'),
            child: Text(l10n.calendarScopeSeries),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
          ),
        ],
      ),
    ),
  );
}
