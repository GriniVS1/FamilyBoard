/// Loading, empty and error states of the kid UI (R9.1-R9.3).
library;

import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import 'kid_tap.dart';
import 'kid_theme.dart';
import 'picto.dart';

/// Placeholder in the final card dimensions (R9.1). Never shows "0" or "—".
class KidSkeletonCard extends StatelessWidget {
  const KidSkeletonCard({required this.height, super.key});

  final double height;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final Color block = tokens.border;
    return Container(
      height: height,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: tokens.surface,
        borderRadius: KidRadius.cardBorder,
        border: Border.all(color: tokens.border, width: 2),
      ),
      child: Row(
        children: <Widget>[
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: block,
              borderRadius: KidRadius.pictoTileBorder,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Container(
                  height: 14,
                  width: 140,
                  decoration: BoxDecoration(
                    color: block,
                    borderRadius: BorderRadius.circular(7),
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  height: 12,
                  width: 48,
                  decoration: BoxDecoration(
                    color: block,
                    borderRadius: BorderRadius.circular(6),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: block, width: 3),
            ),
          ),
        ],
      ),
    );
  }
}

/// Whole-board skeleton: three cards in final size.
class KidChoreSkeleton extends StatelessWidget {
  const KidChoreSkeleton({required this.cardHeight, this.count = 3, super.key});

  final double cardHeight;
  final int count;

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    return Semantics(
      label: l10n.kidLoading,
      container: true,
      child: ExcludeSemantics(
        child: Column(
          children: <Widget>[
            for (int i = 0; i < count; i++) ...<Widget>[
              if (i > 0) const SizedBox(height: 12),
              KidSkeletonCard(height: cardHeight),
            ],
          ],
        ),
      ),
    );
  }
}

/// Big ↻ (64 dp, a main action).
class KidRetryButton extends StatelessWidget {
  const KidRetryButton({required this.onTap, super.key});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    return KidRoundButton(
      size: KidTouch.primary,
      semanticLabel: AppL10n.of(context).kidRetry,
      onTap: onTap,
      child: Icon(Icons.refresh_rounded, size: 36, color: tokens.ink),
    );
  }
}

/// Nothing to show: `relax`, plus a "+" for admins only (R9.2).
class KidEmptyState extends StatelessWidget {
  const KidEmptyState({required this.message, this.onAdd, super.key});

  final String message;

  /// Null for children: no "+" at all, not even an invisible target (R6.3).
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    final AppL10n l10n = AppL10n.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          const KidPicto('relax', size: KidPictoSize.hero),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: KidText.title.copyWith(color: tokens.ink),
          ),
          if (onAdd != null) ...<Widget>[
            const SizedBox(height: 16),
            KidRoundButton(
              size: KidTouch.primary,
              semanticLabel: l10n.kidAddChore,
              onTap: onAdd,
              child: Icon(Icons.add_rounded, size: 36, color: tokens.ink),
            ),
          ],
        ],
      ),
    );
  }
}

/// Load error (R9.3): `oops`, one short line and a big ↻. [compact] is the
/// banner above data that stays visible.
class KidLoadError extends StatelessWidget {
  const KidLoadError({
    required this.message,
    required this.onRetry,
    this.compact = false,
    super.key,
  });

  final String message;
  final VoidCallback onRetry;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final KidTokens tokens = context.kid;
    if (compact) {
      return Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: tokens.dangerTint,
          borderRadius: KidRadius.cardBorder,
          border: Border.all(color: tokens.danger, width: 2),
        ),
        child: Row(
          children: <Widget>[
            const KidPicto('oops', size: 40),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                message,
                style: KidText.label.copyWith(color: tokens.dangerInk),
              ),
            ),
            const SizedBox(width: 8),
            KidRetryButton(onTap: onRetry),
          ],
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          const KidPicto('oops', size: KidPictoSize.hero),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: KidText.title.copyWith(color: tokens.ink),
          ),
          const SizedBox(height: 16),
          KidRetryButton(onTap: onRetry),
        ],
      ),
    );
  }
}
