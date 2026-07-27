---
title: dart format --set-exit-if-changed fails on 9 test files after SDK floor bump
severity: P1
area: frontend
owner: mobile-developer
status: fixed
slice: mobile framework-majors (riverpod 3.4.1, go_router 17.3.0, firebase 4.12.1/16.4.3)
created: 2026-07-27T16:07:21Z
---

## Reproduction

1. `cd mobile && export PATH="$HOME/development/flutter/bin:$PATH"`
2. `dart format --set-exit-if-changed --output=none lib test tool`
3. Observe non-zero exit and 9 files listed as needing reformatting, all under `test/`.

## Expected

The slice's pubspec bump (`environment.sdk: ">=3.3.0 <4.0.0"` → `">=3.12.0 <4.0.0"`) triggers Dart's "tall style" formatter for the whole package (this is exactly why the slice includes a ~90-file reformat). Every file in `mobile/` should therefore already be tall-style formatted, and `dart format --set-exit-if-changed` (item 1 of the standard test plan / presumably a CI gate) should exit 0.

## Actual

9 test files were not included in the reformat pass and now fail the format check on this branch:

```text
Changed test/calendar_setup_model_test.dart
Changed test/event_model_test.dart
Changed test/home_range_provider_test.dart
Changed test/photos_service_test.dart
Changed test/secure_session_store_test.dart
Changed test/setup_member_draft_test.dart
Changed test/setup_onboarding_step_test.dart
Changed test/setup_pin_session_test.dart
Changed test/tab_refresh_test.dart
Formatted 117 files (9 changed) in 0.31 seconds.
EXIT:1
```

Confirmed this is a regression introduced by this slice, not pre-existing: checked out `main` (8b342fb) into a scratch worktree, ran `flutter pub get` there (old SDK floor `>=3.3.0`), then `dart format --set-exit-if-changed test` on the same 9 files — result is clean:

```text
Formatted 16 files (0 changed) in 0.13 seconds.
EXIT:0
```

So on `main` these files are already correctly formatted for the *old* style; on this branch, the SDK-floor bump flips the formatter to tall style for the whole package, and these 9 files were missed by the "~90-file reformat" commit.

Note: `test/home_range_provider_test.dart` *was* touched by this slice (it's in `git status` as modified, for an unrelated `misc.dart` import addition) but the touch didn't include a full reformat pass, so it also fails the check. The other 8 files were not touched at all.

`flutter analyze` and `flutter test` (69/69) both pass regardless, since neither one runs the formatter — only `dart format --set-exit-if-changed` catches this.

## Notes

Likely root cause: the reformat was done with `dart format lib tool` (or similar) but `test/` wasn't fully covered — or `dart format` was invoked before `flutter pub get` picked up the new SDK floor for these specific files, or they were formatted before the pubspec bump landed. Fix: run `dart format lib test tool` again over the whole package and re-verify.

## Fix

`dart format test/` run (9 files); `dart format --set-exit-if-changed lib/ tool/ test/` now passes and all 69 tests stay green. Committed with the stage-3 slice.
