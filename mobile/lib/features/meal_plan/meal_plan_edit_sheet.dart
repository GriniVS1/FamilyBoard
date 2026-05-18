import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/meal_plan.dart';
import '../../models/session.dart';
import '../../services/meal_plan_service.dart';
import '../../state/meal_plan_provider.dart';
import '../../state/session_provider.dart';

/// Opens [MealPlanEditSheet] as a modal bottom sheet.
///
/// Pass [plan] to pre-populate in edit mode; omit for create mode.
/// Pass [takenSlots] so the sheet can suggest the next unfilled slot.
Future<void> showMealPlanEditSheet(
  BuildContext context, {
  MealPlan? plan,
  List<MealSlot> takenSlots = const <MealSlot>[],
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (BuildContext ctx) => MealPlanEditSheet(
      plan: plan,
      takenSlots: takenSlots,
    ),
  );
}

class MealPlanEditSheet extends ConsumerStatefulWidget {
  const MealPlanEditSheet({
    super.key,
    this.plan,
    this.takenSlots = const <MealSlot>[],
  });

  final MealPlan? plan;
  final List<MealSlot> takenSlots;

  @override
  ConsumerState<MealPlanEditSheet> createState() => _MealPlanEditSheetState();
}

class _MealPlanEditSheetState extends ConsumerState<MealPlanEditSheet> {
  late DateTime _date;
  late MealSlot _slot;
  late final TextEditingController _nameController;
  late final TextEditingController _notesController;
  bool _busy = false;

  bool get _isEdit => widget.plan != null;

  MealSlot _defaultSlot() {
    // Pick the first slot of the day not already taken; fall back to dinner.
    for (final MealSlot s in MealSlot.values) {
      if (!widget.takenSlots.contains(s)) {
        return s;
      }
    }
    return MealSlot.dinner;
  }

  @override
  void initState() {
    super.initState();
    final MealPlan? plan = widget.plan;
    _date = plan?.date ?? DateTime.now();
    _slot = plan?.slot ?? _defaultSlot();
    _nameController = TextEditingController(text: plan?.customName ?? '');
    _notesController = TextEditingController(text: plan?.notes ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final DateTime now = DateTime.now();
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked != null && mounted) {
      setState(() => _date = picked);
    }
  }

  Future<void> _save() async {
    final String name = _nameController.text.trim();
    if (name.isEmpty || _busy) {
      return;
    }

    final SessionState sessionState = ref.read(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return;
    }

    setState(() => _busy = true);
    final AppL10n l10n = AppL10n.of(context);
    final MealPlanService service = ref.read(mealPlanServiceProvider);
    final String? notes = _notesController.text.trim().isEmpty
        ? null
        : _notesController.text.trim();

    try {
      if (_isEdit) {
        await service.patch(
          session,
          id: widget.plan!.id,
          date: _date,
          slot: _slot,
          customName: name,
          notes: notes,
        );
      } else {
        await service.upsert(
          session,
          date: _date,
          slot: _slot,
          customName: name,
          notes: notes,
        );
      }
      if (!mounted) {
        return;
      }
      ref.invalidate(mealPlanProvider);
      Navigator.of(context).pop();
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(l10n.mealPlanSavedToast),
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
      Navigator.of(context).pop();
    } on MealPlanFetchException {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(l10n.mealPlanSaveError),
          behavior: SnackBarBehavior.floating,
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

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final String locale = Localizations.localeOf(context).toString();
    final String formattedDate =
        DateFormat('EEEE, d MMM', locale).format(_date);

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
          Text(
            _isEdit ? l10n.mealPlanEditTitle : l10n.mealPlanNewTitle,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 20),

          // Date picker row
          Text(
            l10n.mealPlanDateLabel,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 6),
          OutlinedButton.icon(
            onPressed: _busy ? null : _pickDate,
            icon: const Icon(Icons.calendar_today_outlined, size: 18),
            label: Text(formattedDate),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(double.infinity, 52),
              alignment: Alignment.centerLeft,
            ),
          ),
          const SizedBox(height: 16),

          // Slot selector
          Text(
            l10n.mealPlanSlotLabel,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 6),
          SegmentedButton<MealSlot>(
            segments: MealSlot.values
                .map(
                  (MealSlot s) => ButtonSegment<MealSlot>(
                    value: s,
                    label: Text(
                      _slotLabel(s, l10n),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                )
                .toList(),
            selected: <MealSlot>{_slot},
            onSelectionChanged: _busy
                ? null
                : (Set<MealSlot> sel) {
                    setState(() => _slot = sel.first);
                  },
          ),
          const SizedBox(height: 16),

          // Name field
          TextField(
            controller: _nameController,
            autofocus: !_isEdit,
            textCapitalization: TextCapitalization.sentences,
            textInputAction: TextInputAction.next,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: l10n.mealPlanNameLabel,
              hintText: l10n.mealPlanNamePlaceholder,
            ),
          ),
          const SizedBox(height: 12),

          // Notes field
          TextField(
            controller: _notesController,
            minLines: 2,
            maxLines: 4,
            textCapitalization: TextCapitalization.sentences,
            textInputAction: TextInputAction.done,
            decoration: InputDecoration(
              labelText: l10n.mealPlanNotesLabel,
            ),
          ),
          const SizedBox(height: 20),

          // Actions
          Row(
            children: <Widget>[
              Expanded(
                child: OutlinedButton(
                  onPressed: _busy ? null : () => Navigator.of(context).pop(),
                  child:
                      Text(MaterialLocalizations.of(context).cancelButtonLabel),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: (_busy || _nameController.text.trim().isEmpty)
                      ? null
                      : _save,
                  child: _busy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(l10n.mealPlanSave),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
