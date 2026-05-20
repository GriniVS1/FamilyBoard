import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../state/connectivity_provider.dart';

/// Slim informational banner displayed when the device has no network.
///
/// Animates in/out via [AnimatedSwitcher] + [SizeTransition] so it doesn't
/// jank content below it. Not interactive — no touch targets needed here.
class ConnectivityBanner extends ConsumerWidget {
  const ConnectivityBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<bool> connectivity = ref.watch(connectivityProvider);

    // Treat loading / error states as online — don't show the banner until we
    // know for certain the device is offline.
    final bool isOffline = connectivity.maybeWhen(
      data: (bool online) => !online,
      orElse: () => false,
    );

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      transitionBuilder: (Widget child, Animation<double> animation) {
        return SizeTransition(
          sizeFactor: animation,
          axisAlignment: -1,
          child: child,
        );
      },
      child: isOffline
          ? const _OfflineBanner(key: ValueKey<String>('offline'))
          : const SizedBox.shrink(key: ValueKey<String>('online')),
    );
  }
}

class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      color: colors.errorContainer,
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
      child: Text(
        AppL10n.of(context).offlineBanner,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: colors.onErrorContainer,
              fontWeight: FontWeight.w600,
            ),
        textAlign: TextAlign.center,
      ),
    );
  }
}
