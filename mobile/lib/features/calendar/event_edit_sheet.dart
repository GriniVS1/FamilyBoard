import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/family_member.dart';
import '../../models/event.dart';
import '../../models/recurrence.dart';
import '../../models/session.dart';
import '../../services/events_service.dart';
import '../../state/events_provider.dart';
import '../../state/members_provider.dart';
import '../../state/session_provider.dart';
import '../../theme.dart';
import 'event_shared.dart';

/// All 8 accent names in the canonical order.
const List<String> _kAccentNames = <String>[
  'peach',
  'mint',
  'sun',
  'sky',
  'lilac',
  'rose',
  'teal',
  'sand',
];

/// Opens [EventEditSheet] as a full-height modal bottom sheet.
///
/// Pass [event] to pre-populate for edit mode; omit (null) for create mode.
/// [readOnlyCore] restricts the form to member + color only (GOOGLE/MICROSOFT
/// sourced events). [scope] is required for editing a recurring instance
/// ('instance' or 'series'); ignored for create and non-recurring edits.
Future<void> showEventEditSheet(
  BuildContext context, {
  MobileEvent? event,
  bool readOnlyCore = false,
  String? scope,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (BuildContext ctx) => EventEditSheet(
      event: event,
      readOnlyCore: readOnlyCore,
      scope: scope,
    ),
  );
}

class EventEditSheet extends ConsumerStatefulWidget {
  const EventEditSheet({
    super.key,
    this.event,
    this.readOnlyCore = false,
    this.scope,
  });

  /// Null for create mode.
  final MobileEvent? event;

  /// True when [event] came from a synced (Google/Microsoft) calendar — only
  /// the member and color fields may be changed.
  final bool readOnlyCore;

  /// The PATCH `scope` to send when editing ('instance' or 'series').
  final String? scope;

  @override
  ConsumerState<EventEditSheet> createState() => _EventEditSheetState();
}

class _EventEditSheetState extends ConsumerState<EventEditSheet> {
  late final TextEditingController _titleController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _locationController;
  String? _memberId;
  String _color = 'sky';
  bool _allDay = false;
  late DateTime _startDate;
  late TimeOfDay _startTime;
  late DateTime _endDate;
  late TimeOfDay _endTime;
  RecurrenceFreq _recurrence = RecurrenceFreq.none;
  DateTime? _recurrenceEndDate;
  bool _busy = false;

  bool get _isEdit => widget.event != null;

  @override
  void initState() {
    super.initState();
    final MobileEvent? e = widget.event;
    _titleController = TextEditingController(text: e?.title ?? '');
    _descriptionController = TextEditingController(text: e?.description ?? '');
    _locationController = TextEditingController(text: e?.location ?? '');
    _memberId = e?.member.id;
    _color = e?.color ?? e?.member.color ?? 'sky';
    _allDay = e?.allDay ?? false;

    final DateTime now = DateTime.now();
    final DateTime defaultStart =
        DateTime(now.year, now.month, now.day, now.hour);
    final DateTime start = (e?.startsAt ?? defaultStart).toLocal();
    final DateTime end =
        (e?.endsAt ?? defaultStart.add(const Duration(hours: 1))).toLocal();
    _startDate = DateTime(start.year, start.month, start.day);
    _startTime = TimeOfDay(hour: start.hour, minute: start.minute);
    _endDate = DateTime(end.year, end.month, end.day);
    _endTime = TimeOfDay(hour: end.hour, minute: end.minute);
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  DateTime get _startDateTime => DateTime(
        _startDate.year,
        _startDate.month,
        _startDate.day,
        _allDay ? 0 : _startTime.hour,
        _allDay ? 0 : _startTime.minute,
      );

  DateTime get _endDateTime => DateTime(
        _endDate.year,
        _endDate.month,
        _endDate.day,
        _allDay ? 23 : _endTime.hour,
        _allDay ? 59 : _endTime.minute,
        _allDay ? 59 : 0,
      );

  bool get _isValid {
    if (_memberId == null) {
      return false;
    }
    if (!widget.readOnlyCore && _titleController.text.trim().isEmpty) {
      return false;
    }
    if (!widget.readOnlyCore && !_endDateTime.isAfter(_startDateTime)) {
      return false;
    }
    return true;
  }

  Future<void> _pickDate({required bool isStart}) async {
    final DateTime initial = isStart ? _startDate : _endDate;
    final DateTime now = DateTime.now();
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now.add(const Duration(days: 365 * 2)),
    );
    if (picked == null || !mounted) {
      return;
    }
    setState(() {
      if (isStart) {
        _startDate = picked;
        if (_endDate.isBefore(_startDate)) {
          _endDate = _startDate;
        }
      } else {
        _endDate = picked;
      }
    });
  }

  Future<void> _pickTime({required bool isStart}) async {
    final TimeOfDay initial = isStart ? _startTime : _endTime;
    final TimeOfDay? picked =
        await showTimePicker(context: context, initialTime: initial);
    if (picked == null || !mounted) {
      return;
    }
    setState(() {
      if (isStart) {
        _startTime = picked;
      } else {
        _endTime = picked;
      }
    });
  }

  Future<void> _pickRecurrenceEnd() async {
    final DateTime now = DateTime.now();
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _recurrenceEndDate ?? _startDate,
      firstDate: _startDate,
      lastDate: now.add(const Duration(days: 365 * 5)),
    );
    if (picked == null || !mounted) {
      return;
    }
    setState(() => _recurrenceEndDate = picked);
  }

  Future<void> _save() async {
    if (_busy || !_isValid) {
      return;
    }
    final SessionState sessionState = ref.read(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return;
    }

    setState(() => _busy = true);
    final AppL10n l10n = AppL10n.of(context);
    final EventsService service = ref.read(eventsServiceProvider);

    try {
      if (_isEdit) {
        final String scope = widget.scope ?? 'series';
        final Map<String, Object?> patch = widget.readOnlyCore
            ? <String, Object?>{
                'memberId': _memberId,
                'color': _color,
              }
            : <String, Object?>{
                'memberId': _memberId,
                'title': _titleController.text.trim(),
                'description': _descriptionController.text.trim().isEmpty
                    ? null
                    : _descriptionController.text.trim(),
                'location': _locationController.text.trim().isEmpty
                    ? null
                    : _locationController.text.trim(),
                'startsAt': _startDateTime.toUtc().toIso8601String(),
                'endsAt': _endDateTime.toUtc().toIso8601String(),
                'allDay': _allDay,
                'color': _color,
              };
        await service.updateEvent(
          session: session,
          id: widget.event!.id,
          scope: scope,
          patch: patch,
        );
      } else {
        await service.createEvent(
          session: session,
          memberId: _memberId!,
          title: _titleController.text.trim(),
          description: _descriptionController.text.trim().isEmpty
              ? null
              : _descriptionController.text.trim(),
          location: _locationController.text.trim().isEmpty
              ? null
              : _locationController.text.trim(),
          startsAt: _startDateTime,
          endsAt: _endDateTime,
          allDay: _allDay,
          color: _color,
          rrule: buildRrule(_recurrence, untilDate: _recurrenceEndDate),
        );
      }
      if (!mounted) {
        return;
      }
      ref.invalidate(eventsProvider);
      Navigator.of(context).pop();
    } on EventsSessionRevokedException {
      if (!mounted) {
        return;
      }
      await ref.read(sessionProvider.notifier).clear();
    } on EventsWriteException catch (err) {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(eventWriteErrorMessage(l10n, err.code)),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final String locale = Localizations.localeOf(context).toString();
    final AsyncValue<MembersResult> membersAsync = ref.watch(membersProvider);

    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              _isEdit
                  ? l10n.calendarEventEditTitle
                  : l10n.calendarEventCreateTitle,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            if (widget.readOnlyCore && widget.event != null) ...<Widget>[
              const SizedBox(height: 12),
              EventReadOnlyBanner(source: widget.event!.source, l10n: l10n),
            ],
            const SizedBox(height: 16),
            if (!widget.readOnlyCore) ...<Widget>[
              TextField(
                controller: _titleController,
                autofocus: !_isEdit,
                textCapitalization: TextCapitalization.sentences,
                onChanged: (String _) => setState(() {}),
                decoration: InputDecoration(
                  labelText: l10n.calendarEventTitleLabel,
                ),
              ),
              const SizedBox(height: 16),
            ],
            Text(
              l10n.calendarEventMemberLabel,
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            membersAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: LinearProgressIndicator(),
              ),
              error: (Object err, StackTrace _) => Text(
                l10n.calendarErrorSaveGeneric,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
              data: (MembersResult result) {
                _memberId ??=
                    result.members.isNotEmpty ? result.members.first.id : null;
                return _MemberChipRow(
                  members: result.members,
                  selectedId: _memberId,
                  onSelected: (String id) => setState(() => _memberId = id),
                );
              },
            ),
            const SizedBox(height: 16),
            Text(
              l10n.calendarEventColorLabel,
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            _ColorSwatchRow(
              selectedColor: _color,
              onChanged: (String c) => setState(() => _color = c),
            ),
            if (!widget.readOnlyCore) ...<Widget>[
              const SizedBox(height: 16),
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      l10n.calendarEventAllDayLabel,
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                  ),
                  Switch(
                    value: _allDay,
                    onChanged:
                        _busy ? null : (bool v) => setState(() => _allDay = v),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              _DateTimeRow(
                label: l10n.calendarEventStartLabel,
                date: _startDate,
                time: _startTime,
                allDay: _allDay,
                locale: locale,
                busy: _busy,
                onPickDate: () => _pickDate(isStart: true),
                onPickTime: () => _pickTime(isStart: true),
              ),
              const SizedBox(height: 8),
              _DateTimeRow(
                label: l10n.calendarEventEndLabel,
                date: _endDate,
                time: _endTime,
                allDay: _allDay,
                locale: locale,
                busy: _busy,
                onPickDate: () => _pickDate(isStart: false),
                onPickTime: () => _pickTime(isStart: false),
              ),
              if (!_endDateTime.isAfter(_startDateTime)) ...<Widget>[
                const SizedBox(height: 8),
                Text(
                  l10n.calendarValidationEndAfterStart,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const SizedBox(height: 16),
              TextField(
                controller: _locationController,
                decoration: InputDecoration(
                  labelText: l10n.calendarEventLocationLabel,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _descriptionController,
                minLines: 2,
                maxLines: 5,
                decoration: InputDecoration(
                  labelText: l10n.calendarEventDescriptionLabel,
                ),
              ),
              if (!_isEdit) ...<Widget>[
                const SizedBox(height: 16),
                Text(
                  l10n.calendarEventRecurrenceLabel,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 8),
                _RecurrencePicker(
                  value: _recurrence,
                  l10n: l10n,
                  busy: _busy,
                  onChanged: (RecurrenceFreq f) =>
                      setState(() => _recurrence = f),
                ),
                if (_recurrence != RecurrenceFreq.none) ...<Widget>[
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _busy ? null : _pickRecurrenceEnd,
                    icon: const Icon(Icons.event_busy_outlined, size: 18),
                    label: Text(
                      _recurrenceEndDate == null
                          ? l10n.calendarEventRecurrenceEndNone
                          : DateFormat.yMMMd(locale)
                              .format(_recurrenceEndDate!),
                    ),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 52),
                      alignment: Alignment.centerLeft,
                    ),
                  ),
                ],
              ],
            ],
            const SizedBox(height: 20),
            Row(
              children: <Widget>[
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : () => Navigator.of(context).pop(),
                    child: Text(
                      MaterialLocalizations.of(context).cancelButtonLabel,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: (_busy || !_isValid) ? null : _save,
                    child: _busy
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(l10n.calendarEventSave),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MemberChipRow extends StatelessWidget {
  const _MemberChipRow({
    required this.members,
    required this.selectedId,
    required this.onSelected,
  });

  final List<FamilyMember> members;
  final String? selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: members.map((FamilyMember member) {
        final bool selected = member.id == selectedId;
        final Color accent = AccentPalette.resolve(member.color);
        return GestureDetector(
          onTap: () => onSelected(member.id),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            constraints: const BoxConstraints(minHeight: 44),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              color: selected ? accent : accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                color: selected ? accent : accent.withValues(alpha: 0.5),
              ),
            ),
            child: Center(
              child: Text(
                '${member.emoji} ${member.name}'.trim(),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: selected ? Colors.white : accent,
                      fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _ColorSwatchRow extends StatelessWidget {
  const _ColorSwatchRow({
    required this.selectedColor,
    required this.onChanged,
  });

  final String selectedColor;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _kAccentNames.map((String name) {
        final Color color = AccentPalette.resolve(name);
        final bool selected = name == selectedColor;
        return GestureDetector(
          onTap: () => onChanged(name),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: Border.all(
                color: selected
                    ? Theme.of(context).colorScheme.onSurface
                    : Colors.transparent,
                width: selected ? 3 : 0,
              ),
              boxShadow: selected
                  ? <BoxShadow>[
                      BoxShadow(
                        color: color.withValues(alpha: 0.5),
                        blurRadius: 6,
                        spreadRadius: 1,
                      ),
                    ]
                  : null,
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _DateTimeRow extends StatelessWidget {
  const _DateTimeRow({
    required this.label,
    required this.date,
    required this.time,
    required this.allDay,
    required this.locale,
    required this.busy,
    required this.onPickDate,
    required this.onPickTime,
  });

  final String label;
  final DateTime date;
  final TimeOfDay time;
  final bool allDay;
  final String locale;
  final bool busy;
  final VoidCallback onPickDate;
  final VoidCallback onPickTime;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        SizedBox(
          width: 72,
          child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
        ),
        Expanded(
          child: OutlinedButton(
            onPressed: busy ? null : onPickDate,
            style: OutlinedButton.styleFrom(alignment: Alignment.centerLeft),
            child: Text(DateFormat.yMMMd(locale).format(date)),
          ),
        ),
        if (!allDay) ...<Widget>[
          const SizedBox(width: 8),
          Expanded(
            child: OutlinedButton(
              onPressed: busy ? null : onPickTime,
              style: OutlinedButton.styleFrom(alignment: Alignment.centerLeft),
              child: Text(time.format(context)),
            ),
          ),
        ],
      ],
    );
  }
}

class _RecurrencePicker extends StatelessWidget {
  const _RecurrencePicker({
    required this.value,
    required this.l10n,
    required this.busy,
    required this.onChanged,
  });

  final RecurrenceFreq value;
  final AppL10n l10n;
  final bool busy;
  final ValueChanged<RecurrenceFreq> onChanged;

  String _label(RecurrenceFreq freq) {
    switch (freq) {
      case RecurrenceFreq.none:
        return l10n.calendarEventRecurrenceNone;
      case RecurrenceFreq.daily:
        return l10n.calendarEventRecurrenceDaily;
      case RecurrenceFreq.weekly:
        return l10n.calendarEventRecurrenceWeekly;
      case RecurrenceFreq.monthly:
        return l10n.calendarEventRecurrenceMonthly;
    }
  }

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<RecurrenceFreq>(
      segments: RecurrenceFreq.values
          .map(
            (RecurrenceFreq f) => ButtonSegment<RecurrenceFreq>(
              value: f,
              label: Text(_label(f), overflow: TextOverflow.ellipsis),
            ),
          )
          .toList(),
      selected: <RecurrenceFreq>{value},
      onSelectionChanged:
          busy ? null : (Set<RecurrenceFreq> sel) => onChanged(sel.first),
    );
  }
}
