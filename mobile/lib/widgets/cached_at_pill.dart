import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';

/// Small pill indicating that the data was loaded from the local disk cache.
///
/// Pass [staleAt] from the service result type (e.g. [TodayPayload.staleAt]).
/// Renders nothing when [staleAt] is null (live data).
class CachedAtPill extends StatelessWidget {
  const CachedAtPill({super.key, required this.staleAt});

  final DateTime? staleAt;

  @override
  Widget build(BuildContext context) {
    if (staleAt == null) return const SizedBox.shrink();

    final String locale = Localizations.localeOf(context).toString();
    final String timeStr = DateFormat.Hm(locale).format(staleAt!.toLocal());

    final ColorScheme colors = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: colors.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(
            Icons.history,
            size: 13,
            color: colors.onSurfaceVariant,
          ),
          const SizedBox(width: 4),
          Text(
            AppL10n.of(context).staleData(timeStr),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: colors.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );
  }
}
