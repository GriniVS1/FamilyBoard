import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../models/meal_plan.dart';
import '../../services/meal_plan_service.dart';
import '../../state/meal_plan_provider.dart';
import '../../state/session_provider.dart';
import '../../theme.dart';
import '../../widgets/familyboard_logo.dart';

class MealPlanScreen extends ConsumerWidget {
  const MealPlanScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppL10n l10n = AppL10n.of(context);
    final AsyncValue<List<MealPlan>> mealPlanAsync =
        ref.watch(mealPlanProvider);

    return Scaffold(
      appBar: AppBar(
        title: const FamilyBoardLogo(fontSize: 18),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(mealPlanProvider);
            try {
              await ref.read(mealPlanProvider.future);
            } catch (_) {}
          },
          child: mealPlanAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (Object err, StackTrace _) => _ErrorBody(
              error: err,
              l10n: l10n,
              onRetry: () => ref.invalidate(mealPlanProvider),
              onSessionExpired: () async {
                await ref.read(sessionProvider.notifier).clear();
              },
            ),
            data: (List<MealPlan> plans) => plans.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: <Widget>[
                      SizedBox(
                        height: MediaQuery.of(context).size.height * 0.5,
                        child: _EmptyState(l10n: l10n),
                      ),
                    ],
                  )
                : _WeekBody(plans: plans, l10n: l10n),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Week body — grouped by day then slot
// ---------------------------------------------------------------------------

class _WeekBody extends StatelessWidget {
  const _WeekBody({required this.plans, required this.l10n});

  final List<MealPlan> plans;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    final DateTime now = DateTime.now();
    final DateTime weekStart = now.subtract(Duration(days: now.weekday - 1));

    final Map<String, List<MealPlan>> grouped = <String, List<MealPlan>>{};
    for (final MealPlan plan in plans) {
      final String key =
          '${plan.date.year.toString().padLeft(4, '0')}-${plan.date.month.toString().padLeft(2, '0')}-${plan.date.day.toString().padLeft(2, '0')}';
      grouped.putIfAbsent(key, () => <MealPlan>[]).add(plan);
    }

    const List<int> slotOrder = <int>[0, 1, 2, 3];
    final List<Widget> rows = <Widget>[];
    final String locale = Localizations.localeOf(context).toString();

    for (int i = 0; i < 7; i++) {
      final DateTime day = weekStart.add(Duration(days: i));
      final String key =
          '${day.year.toString().padLeft(4, '0')}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';
      final List<MealPlan>? dayPlans = grouped[key];
      if (dayPlans == null || dayPlans.isEmpty) {
        continue;
      }

      rows.add(_DayHeader(date: day, locale: locale));

      final List<MealPlan> sorted = List<MealPlan>.from(dayPlans)
        ..sort((MealPlan a, MealPlan b) =>
            slotOrder.indexOf(a.slot.index) - slotOrder.indexOf(b.slot.index));

      for (final MealPlan plan in sorted) {
        rows.add(_SlotRow(plan: plan, l10n: l10n));
      }
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 24),
      children: rows,
    );
  }
}

// ---------------------------------------------------------------------------
// Day header
// ---------------------------------------------------------------------------

class _DayHeader extends StatelessWidget {
  const _DayHeader({required this.date, required this.locale});

  final DateTime date;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final String label = DateFormat('EEEE, d MMM', locale).format(date);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Text(
        label.toUpperCase(),
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.5),
              fontWeight: FontWeight.w700,
              fontSize: 11,
              letterSpacing: 0.8,
            ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Slot row
// ---------------------------------------------------------------------------

class _SlotRow extends StatelessWidget {
  const _SlotRow({required this.plan, required this.l10n});

  final MealPlan plan;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    final ColorScheme colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
      child: Container(
        constraints: const BoxConstraints(minHeight: 52),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: colorScheme.outline),
        ),
        child: Row(
          children: <Widget>[
            SizedBox(
              width: 80,
              child: Text(
                _slotLabel(plan.slot, l10n),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurface.withValues(alpha: 0.5),
                      fontSize: 12,
                    ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                plan.displayName,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
            ),
            if (plan.member != null) ...<Widget>[
              const SizedBox(width: 8),
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: AccentPalette.resolve(plan.member!.color),
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

String _slotLabel(MealSlot slot, AppL10n l10n) {
  switch (slot) {
    case MealSlot.breakfast:
      return l10n.mealPlanSlotBreakfast;
    case MealSlot.lunch:
      return l10n.mealPlanSlotLunch;
    case MealSlot.dinner:
      return l10n.mealPlanSlotDinner;
    case MealSlot.snack:
      return l10n.mealPlanSlotSnack;
  }
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.l10n});

  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              Icons.restaurant_menu_outlined,
              size: 64,
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.2),
            ),
            const SizedBox(height: 16),
            Text(
              l10n.mealPlanEmpty,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.5),
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              l10n.mealPlanEmptySubtitle,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.4),
                  ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({
    required this.error,
    required this.l10n,
    required this.onRetry,
    required this.onSessionExpired,
  });

  final Object error;
  final AppL10n l10n;
  final VoidCallback onRetry;
  final VoidCallback onSessionExpired;

  @override
  Widget build(BuildContext context) {
    final bool isSessionError = error is MealPlanSessionRevokedException;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              isSessionError ? l10n.homeSessionExpired : l10n.mealPlanLoadError,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: isSessionError ? onSessionExpired : onRetry,
              child: Text(l10n.homeRetry),
            ),
          ],
        ),
      ),
    );
  }
}
