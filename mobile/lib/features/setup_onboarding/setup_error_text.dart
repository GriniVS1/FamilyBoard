import 'package:flutter/material.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../services/setup_service.dart';

/// Renders a [SetupErrorKind] as a localized inline error banner. Shared
/// across every onboarding wizard step so a network hiccup, a stale PIN, or
/// an unexpected server error all get the same look.
class SetupErrorText extends StatelessWidget {
  const SetupErrorText({super.key, required this.kind});

  final SetupErrorKind kind;

  static String message(AppL10n l10n, SetupErrorKind kind) {
    switch (kind) {
      case SetupErrorKind.network:
        return l10n.setupErrorNetwork;
      case SetupErrorKind.tooManyAttempts:
        return l10n.setupErrorTooManyAttempts;
      case SetupErrorKind.invalidPin:
        return l10n.setupErrorInvalidPin;
      case SetupErrorKind.notFound:
        return l10n.setupErrorNotFound;
      case SetupErrorKind.validation:
        return l10n.setupErrorValidation;
      case SetupErrorKind.alreadyComplete:
      case SetupErrorKind.unknown:
        return l10n.setupErrorUnknown;
    }
  }

  @override
  Widget build(BuildContext context) {
    final ColorScheme scheme = Theme.of(context).colorScheme;
    final AppL10n l10n = AppL10n.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: scheme.errorContainer,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.error_outline, color: scheme.onErrorContainer),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message(l10n, kind),
              style: TextStyle(color: scheme.onErrorContainer),
            ),
          ),
        ],
      ),
    );
  }
}
