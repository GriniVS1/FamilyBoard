/// Recurrence helpers for the mobile event editor.
///
/// [buildRrule] mirrors the wall's `buildRrule` in
/// `src/components/calendar/event-dialog.tsx`: FREQ-only, with an optional
/// UNTIL fixed at UTC midnight of the chosen end date — the wall's
/// recurrence-end picker is a plain calendar date, not a date+time, so the
/// UNTIL token is always `T000000Z`.
library;

enum RecurrenceFreq { none, daily, weekly, monthly }

/// Builds an RRULE value (the part after "RRULE:"), or null for
/// [RecurrenceFreq.none]. [untilDate]'s year/month/day are used verbatim —
/// callers should pass the calendar date the user picked, not a UTC-converted
/// instant.
String? buildRrule(RecurrenceFreq freq, {DateTime? untilDate}) {
  if (freq == RecurrenceFreq.none) {
    return null;
  }
  final String freqToken = switch (freq) {
    RecurrenceFreq.daily => 'DAILY',
    RecurrenceFreq.weekly => 'WEEKLY',
    RecurrenceFreq.monthly => 'MONTHLY',
    RecurrenceFreq.none => '',
  };
  String rule = 'FREQ=$freqToken';
  if (untilDate != null) {
    String pad(int n) => n.toString().padLeft(2, '0');
    final String until =
        '${untilDate.year}${pad(untilDate.month)}${pad(untilDate.day)}T000000Z';
    rule += ';UNTIL=$until';
  }
  return rule;
}
