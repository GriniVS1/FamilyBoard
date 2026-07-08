---
title: "Mobile CaldavCalendarOption reads 'name' but the API returns 'displayName' — crashes CalDAV calendar picker"
severity: P1
area: frontend
owner: mobile-developer
status: fixed
slice: calendar setup from paired phone
created: 2026-07-08T07:32:00Z
---

## Reproduction (code review + confirmed API shape; see Notes for why not driven fully end-to-end)

1. Backend: `src/lib/caldav.ts` defines `DiscoveredCalendar`:
   ```ts
   export type DiscoveredCalendar = {
     url: string;
     displayName: string;
     ctag: string | null;
     color?: string;
   };
   ```
2. `connectCaldav` in `src/lib/calendar-connect.ts` returns `{ calendars }` where each item is a
   `DiscoveredCalendar` verbatim (no key renaming), and `src/app/api/mobile/calendar/connect-caldav/route.ts`
   passes that straight through via `ok(result)`. So `POST /api/mobile/calendar/connect-caldav`
   responds with `{ "calendars": [ { "url": "...", "displayName": "...", "ctag": ..., "color": ... } ] }`.
3. The wall's own (pre-existing, working) consumer confirms this is the real contract —
   `src/components/settings/caldav-connect-dialog.tsx` reads `cal.displayName` (line 423) and
   `selectedCalendar.displayName` (line 173).
4. Mobile: `mobile/lib/models/calendar_setup.dart`'s `CaldavCalendarOption.fromJson`:
   ```dart
   factory CaldavCalendarOption.fromJson(Map<String, Object?> json) {
     return CaldavCalendarOption(
       url: json['url']! as String,
       name: json['name']! as String,   // <-- API sends "displayName", not "name"
     );
   }
   ```
5. Called from `calendar_setup_service.dart`'s `connectCaldav()` immediately after a successful
   `connect-caldav` call, on every discovered calendar in the response.

## Expected

After a successful CalDAV credential check, the mobile app should list the discovered calendars
by name (as the wall already does today) and let the user pick one.

## Actual

`json['name']` is not present in the API response (the field is `displayName`), so
`json['name']! as String` executes a null-check operator on `null`, which throws a Dart runtime
error (`Null check operator used on a null value`) inside `CaldavCalendarOption.fromJson` the
moment a CalDAV connect attempt succeeds with valid credentials. This is unrecoverable in
`_submitCaldavForm` (`mobile/lib/features/settings/settings_screen.dart`) — the exception is not
a `DioException`/`CalendarSetupException` so it isn't caught by the existing `try { ... } on
CalendarSetupException catch` block, so it propagates as an uncaught exception.

## Evidence

```text
$ grep -n "displayName" src/lib/caldav.ts
65:  displayName: string;

$ grep -n "displayName" src/components/settings/caldav-connect-dialog.tsx
64:  displayName: string;
173:            calendarName: selectedCalendar.displayName,
423:                        {cal.displayName}

$ grep -n "'name'" mobile/lib/models/calendar_setup.dart
      name: json['name']! as String,
```

`flutter analyze` and `flutter test` both pass clean (no static or unit-test coverage catches
this — there is no unit test constructing a `CaldavCalendarOption` from a realistic JSON payload
matching the actual backend shape; `mobile/test/widget_test.dart` only has two smoke tests
unrelated to calendar setup).

## Notes

- Not driven through a live successful CalDAV discovery in this session (no real
  iCloud/Fastmail/Nextcloud test account available in this sandboxed environment; a bogus-creds
  attempt correctly returned `401 CALDAV_AUTH_FAILED` before reaching the calendars array — see
  the connect-caldav auth-failure test in the slice's other passing checks). The field mismatch
  is unambiguous from comparing the Prisma-adjacent backend type, the actual route pass-through,
  and the pre-existing wall consumer against the Flutter model, so this is filed with high
  confidence despite not being triggered live.
- Fix belongs on the mobile side: change `CaldavCalendarOption.fromJson` to read `displayName`
  (and update `mobile/lib/features/settings/settings_screen.dart`'s `option.name` usages, or keep
  the Dart field named `name` and just fix the JSON key it reads — either way, `displayName` is
  the established, working contract on the wall side and should not change).

## Fix

- `mobile/lib/models/calendar_setup.dart`: `CaldavCalendarOption.fromJson` now reads
  `json['displayName']` instead of `json['name']`. Kept the Dart field named `name` (per the
  report's suggested option) so no call sites elsewhere in mobile needed to change.
- Confirmed the request-side field is unaffected: `select-caldav-calendar` (both
  `mobile/lib/services/calendar_setup_service.dart`'s `selectCaldavCalendar` and
  `src/app/api/mobile/calendar/select-caldav-calendar/route.ts`) uses a request body key
  `calendarName`, which is a different, pre-existing contract (the wire key name for the
  selection payload, not the discovery response). `settings_screen.dart` passes
  `option.name` as that value — correct now that `option.name` is populated from
  `displayName` instead of `null`-crashing.
- No other call sites needed changes: `mobile/lib/features/settings/settings_screen.dart`'s
  `option.name` usages (list display + selection request) work unmodified since the Dart-side
  field name didn't change, only its JSON source key.
- Added `mobile/test/calendar_setup_model_test.dart` — regression unit test constructing
  `CaldavCalendarOption` from a realistic `displayName`-shaped payload, closing the test gap
  called out in this report's Evidence section.

### Verification

- `flutter analyze` — no issues found.
- `flutter test` — 3 tests pass (2 pre-existing smoke tests + 1 new regression test).
- `dart format lib/ tool/ test/` — clean, 0 files changed.
