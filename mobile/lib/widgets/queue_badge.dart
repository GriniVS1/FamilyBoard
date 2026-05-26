import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../state/write_queue_provider.dart';

/// Small pill showing "N pending" when there are items in the write queue.
///
/// Renders nothing when the queue is empty, so it is safe to include in
/// every screen header.
class QueueBadge extends ConsumerWidget {
  const QueueBadge({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<int> countAsync = ref.watch(queueCountProvider);
    final int count = countAsync.valueOrNull ?? 0;

    if (count == 0) return const SizedBox.shrink();

    final ColorScheme colors = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: colors.tertiaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(
            Icons.schedule,
            size: 14,
            color: colors.onTertiaryContainer,
          ),
          const SizedBox(width: 4),
          Text(
            AppL10n.of(context).queuePending(count),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: colors.onTertiaryContainer,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}
