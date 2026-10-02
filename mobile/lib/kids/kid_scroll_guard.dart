import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/kid_clock_provider.dart';

/// Wrap the scrollable that holds a chore list: a scroll leaves taps in that
/// list unreliable for 300 ms (R5.5), and any scroll counts as a touch that
/// keeps the layout from re-sorting (R5.4).
class KidScrollGuard extends ConsumerWidget {
  const KidScrollGuard({required this.listKey, required this.child, super.key});

  final String listKey;
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return NotificationListener<ScrollNotification>(
      onNotification: (ScrollNotification n) {
        if (n is ScrollStartNotification ||
            n is ScrollUpdateNotification ||
            n is ScrollEndNotification) {
          final guard = ref.read(tapGuardProvider);
          guard.recordScroll(listKey);
          guard.touch();
        }
        return false;
      },
      child: child,
    );
  }
}
