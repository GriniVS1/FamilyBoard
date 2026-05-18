import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/meal_plan.dart';
import '../../models/session.dart';
import '../../services/meal_plan_service.dart';
import '../../state/grocery_provider.dart';
import '../../state/meal_plan_provider.dart';
import '../../state/session_provider.dart';
import '../../theme.dart';
import '../../widgets/familyboard_logo.dart';
import 'meal_plan_edit_sheet.dart';

class MealPlanScreen extends ConsumerStatefulWidget {
  const MealPlanScreen({super.key});

  @override
  ConsumerState<MealPlanScreen> createState() => _MealPlanScreenState();
}

class _MealPlanScreenState extends ConsumerState<MealPlanScreen> {
  bool _generateBusy = false;

  Future<void> _onGenerateGrocery(
    List<MealPlan> plans,
    AppL10n l10n,
  ) async {
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        title: Text(l10n.mealPlanGenerateGroceryConfirmTitle),
        content: Text(l10n.mealPlanGenerateGroceryConfirmBody),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.mealPlanGenerateGroceryConfirmAdd),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) {
      return;
    }

    final SessionState sessionState = ref.read(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return;
    }

    final DateTime now = DateTime.now();
    final DateTime weekStart =
        DateTime(now.year, now.month, now.day - (now.weekday - 1));

    setState(() => _generateBusy = true);
    try {
      final int count = await ref
          .read(mealPlanServiceProvider)
          .generateGroceryFromWeek(session, startDate: weekStart);
      if (!mounted) {
        return;
      }
      ref.invalidate(groceryProvider);
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(
            count == 0
                ? l10n.mealPlanGenerateGroceryToastZero
                : l10n.mealPlanGenerateGroceryToast(count),
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on MealPlanGroceryCapReachedException {
      if (!mounted) {
        return;
      }
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(l10n.mealPlanGenerateGroceryErrorCap),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on MealPlanSessionRevokedException {
      if (!mounted) {
        return;
      }
      await ref.read(sessionProvider.notifier).clear();
    } on MealPlanFetchException {
      if (!mounted) {
        return;
      }
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(l10n.mealPlanGenerateGroceryErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _generateBusy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final AsyncValue<List<MealPlan>> mealPlanAsync =
        ref.watch(mealPlanProvider);

    final List<MealPlan>? plans = mealPlanAsync.valueOrNull;
    final bool hasPlans = plans != null && plans.isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: const FamilyBoardLogo(fontSize: 18),
        actions: hasPlans
            ? <Widget>[
                if (_generateBusy)
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                else
                  IconButton(
                    icon: const Icon(Icons.shopping_basket_outlined),
                    tooltip: l10n.mealPlanGenerateGrocery,
                    onPressed: () => _onGenerateGrocery(plans, l10n),
                  ),
              ]
            : null,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          final List<MealSlot> todayTaken = plans
                  ?.where((MealPlan p) {
                    final DateTime now = DateTime.now();
                    return p.date.year == now.year &&
                        p.date.month == now.month &&
                        p.date.day == now.day;
                  })
                  .map((MealPlan p) => p.slot)
                  .toList() ??
              <MealSlot>[];
          showMealPlanEditSheet(context, takenSlots: todayTaken);
        },
        icon: const Icon(Icons.add),
        label: Text(l10n.mealPlanNew),
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
            data: (List<MealPlan> planList) => planList.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: <Widget>[
                      SizedBox(
                        height: MediaQuery.of(context).size.height * 0.5,
                        child: _EmptyState(l10n: l10n),
                      ),
                    ],
                  )
                : _WeekBody(plans: planList, l10n: l10n),
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
        rows.add(_SlotRow(plan: plan, l10n: l10n, dayPlans: sorted));
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

class _SlotRow extends ConsumerStatefulWidget {
  const _SlotRow({
    required this.plan,
    required this.l10n,
    required this.dayPlans,
  });

  final MealPlan plan;
  final AppL10n l10n;
  final List<MealPlan> dayPlans;

  @override
  ConsumerState<_SlotRow> createState() => _SlotRowState();
}

class _SlotRowState extends ConsumerState<_SlotRow> {
  bool _busy = false;

  Future<void> _handleTap() async {
    final List<MealSlot> taken = widget.dayPlans
        .where((MealPlan p) => p.id != widget.plan.id)
        .map((MealPlan p) => p.slot)
        .toList();
    await showMealPlanEditSheet(
      context,
      plan: widget.plan,
      takenSlots: taken,
    );
  }

  Future<void> _handleLongPress() async {
    final AppL10n l10n = widget.l10n;
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        title: Text(l10n.mealPlanDeleteConfirmTitle),
        content: Text(l10n.mealPlanDeleteConfirmBody),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.mealPlanDeleteConfirmAction),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) {
      return;
    }

    final SessionState sessionState = ref.read(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return;
    }

    setState(() => _busy = true);
    try {
      await ref
          .read(mealPlanServiceProvider)
          .delete(session, id: widget.plan.id);
      if (!mounted) {
        return;
      }
      ref.invalidate(mealPlanProvider);
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(l10n.mealPlanDeleteToast),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on MealPlanSessionRevokedException {
      if (!mounted) {
        return;
      }
      await ref.read(sessionProvider.notifier).clear();
    } on MealPlanNotFoundException {
      if (!mounted) {
        return;
      }
      ref.invalidate(mealPlanProvider);
    } on MealPlanFetchException {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(l10n.mealPlanDeleteError),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final ColorScheme colorScheme = Theme.of(context).colorScheme;
    final MealPlan plan = widget.plan;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
      child: AnimatedOpacity(
        opacity: _busy ? 0.5 : 1.0,
        duration: const Duration(milliseconds: 150),
        child: GestureDetector(
          onTap: _busy ? null : _handleTap,
          onLongPress: _busy ? null : _handleLongPress,
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
                    _slotLabel(plan.slot, widget.l10n),
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
